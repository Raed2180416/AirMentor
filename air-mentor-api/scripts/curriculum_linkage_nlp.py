#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import os
import re
import sys
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from functools import lru_cache
from typing import Any, Iterable

STOP_WORDS = {
    'the', 'and', 'for', 'with', 'into', 'from', 'that', 'this', 'their', 'your', 'using', 'used', 'are', 'was', 'were',
    'will', 'have', 'has', 'had', 'over', 'under', 'before', 'after', 'unit', 'module', 'topic', 'topics', 'course',
    'courses', 'semester', 'theory', 'lab', 'laboratory', 'workbook', 'analysis', 'design', 'system', 'systems',
    'study', 'studies', 'level', 'knowledge', 'based', 'applications', 'application', 'prerequisite', 'requires',
}

PREREQ_CUES = [
    'prerequisite',
    'prerequisites',
    'requires',
    'require',
    'before taking',
    'before this course',
    'must have',
    'should know',
    'should have studied',
    'needs prior',
    'foundation for',
    'background in',
]

COURSE_CODE_RE = re.compile(r'\b[A-Z]{2,}[0-9]{2,}[A-Z]?\b')


def normalize_text(value: str) -> str:
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9]+', ' ', value.lower())).strip()


def tokenize(value: str) -> list[str]:
    tokens = []
    seen = set()
    for token in normalize_text(value).split():
      # Keep the token list compact and stable for downstream scoring.
        if len(token) < 3 or token in STOP_WORDS or token in seen:
            continue
        seen.add(token)
        tokens.append(token)
    return tokens


def join_text(bundle: dict[str, Any]) -> str:
    parts: list[str] = [
        str(bundle.get('courseCode', '')).strip(),
        str(bundle.get('title', '')).strip(),
    ]
    outcomes = bundle.get('outcomes') or []
    bridge_modules = bundle.get('bridgeModules') or []
    topic_partitions = bundle.get('topicPartitions') or {}
    prerequisites = bundle.get('prerequisites') or []
    for outcome in outcomes:
        parts.append(str(outcome.get('desc', '')).strip())
    parts.extend(str(item).strip() for item in bridge_modules)
    for key in ('tt1', 'tt2', 'see', 'workbook'):
        parts.extend(str(item).strip() for item in (topic_partitions.get(key) or []))
    for prerequisite in prerequisites:
        parts.append(str(prerequisite.get('sourceCourseCode', '')).strip())
        parts.append(str(prerequisite.get('rationale', '')).strip())
    return ' '.join(part for part in parts if part)


def split_sentences(text: str) -> list[str]:
    chunks = re.split(r'(?<=[.!?])\s+|\n+', text)
    return [chunk.strip() for chunk in chunks if chunk.strip()]


def build_course_reference_index(items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for item in items:
        code = str(item.get('courseCode', '')).strip().lower()
        title = normalize_text(str(item.get('title', '')))
        if code:
            index.setdefault(code, item)
        if title:
            index.setdefault(title, item)
    return index


def course_family(course_code: str) -> str:
    normalized = re.sub(r'[^a-z0-9]+', '', course_code.lower())
    match = re.match(r'([a-z]+)', normalized)
    return match.group(1) if match else normalized


def cosine_similarity(left: Iterable[float], right: Iterable[float]) -> float:
    left_list = list(left)
    right_list = list(right)
    if len(left_list) != len(right_list) or not left_list:
        return 0.0
    dot = sum(l * r for l, r in zip(left_list, right_list))
    left_norm = math.sqrt(sum(l * l for l in left_list))
    right_norm = math.sqrt(sum(r * r for r in right_list))
    if left_norm <= 0 or right_norm <= 0:
        return 0.0
    return max(0.0, min(1.0, dot / (left_norm * right_norm)))


@lru_cache(maxsize=1)
def load_spacy_tools():
    try:
        import spacy
        from spacy.matcher import PhraseMatcher
        from spacy.pipeline import EntityRuler
    except Exception as exc:  # pragma: no cover - dependency failures are environment specific.
        return None, None, None, str(exc)

    nlp = spacy.blank('en')
    ruler = nlp.add_pipe('entity_ruler')
    assert isinstance(ruler, EntityRuler)
    matcher = PhraseMatcher(nlp.vocab, attr='LOWER')
    return nlp, matcher, ruler, None


@lru_cache(maxsize=1)
def load_sentence_transformer():
    try:
        from sentence_transformers import SentenceTransformer
    except Exception as exc:  # pragma: no cover - dependency failures are environment specific.
        return None, str(exc)

    try:
        model = SentenceTransformer('all-MiniLM-L6-v2')
    except Exception as exc:  # pragma: no cover - model download failures are environment specific.
        return None, str(exc)
    return model, None


def add_course_patterns(nlp, matcher, ruler, items: list[dict[str, Any]]) -> None:
    code_patterns = []
    title_patterns = []
    cue_patterns = []
    for item in items:
        code = str(item.get('courseCode', '')).strip()
        title = str(item.get('title', '')).strip()
        if code:
            code_patterns.append(nlp.make_doc(code))
            ruler.add_patterns([{
                'label': 'COURSE_CODE',
                'pattern': code,
                'id': code.lower(),
            }])
        if title:
            title_patterns.append(nlp.make_doc(title))
            ruler.add_patterns([{
                'label': 'COURSE_TITLE',
                'pattern': title,
                'id': title.lower(),
            }])
    for cue in PREREQ_CUES:
        ruler.add_patterns([{
            'label': 'PREREQ_CUE',
            'pattern': cue,
            'id': cue,
        }])
    if code_patterns:
        matcher.add('COURSE_CODE_MATCH', code_patterns)
    if title_patterns:
        matcher.add('COURSE_TITLE_MATCH', title_patterns)


def build_phrased_deterministic_candidates(items: list[dict[str, Any]], manifest_items: list[dict[str, Any]] | None) -> tuple[dict[tuple[str, str], dict[str, Any]], list[str]]:
    warnings: list[str] = []
    candidates: dict[tuple[str, str], dict[str, Any]] = {}
    reference_index = build_course_reference_index(items)

    nlp, matcher, ruler, error = load_spacy_tools()
    if error:
        warnings.append(f'spaCy unavailable: {error}')
        return candidates, warnings

    add_course_patterns(nlp, matcher, ruler, items)

    def add_candidate(target: dict[str, Any], source: dict[str, Any], edge_kind: str, rationale: str, confidence: int, sources: list[str], signal_summary: dict[str, Any]):
        if str(source.get('courseCode', '')).strip().lower() == str(target.get('courseCode', '')).strip().lower():
            return
        if int(source.get('semesterNumber', 0)) >= int(target.get('semesterNumber', 0)):
            return
        key = (
            str(target.get('curriculumCourseId', '')).strip(),
            f"{str(source.get('courseCode', '')).strip().lower()}::{edge_kind}",
        )
        current = candidates.get(key)
        payload = {
            'curriculumCourseId': str(target.get('curriculumCourseId', '')).strip(),
            'targetCourseCode': str(target.get('courseCode', '')).strip(),
            'targetTitle': str(target.get('title', '')).strip(),
            'sourceCourseCode': str(source.get('courseCode', '')).strip(),
            'sourceTitle': str(source.get('title', '')).strip(),
            'edgeKind': edge_kind,
            'rationale': rationale,
            'confidenceScaled': confidence,
            'sources': sources,
            'signalSummary': signal_summary,
        }
        if not current or confidence > int(current['confidenceScaled']):
            candidates[key] = payload
        else:
            merged_sources = list(dict.fromkeys([*current['sources'], *sources]))
            merged_signal = dict(current['signalSummary'])
            merged_signal.update(signal_summary)
            current['sources'] = merged_sources
            current['signalSummary'] = merged_signal

    for target in items:
        target_text = join_text(target)
        target_doc = nlp(target_text)
        target_sentence_text = ' '.join(split_sentences(target_text))
        target_refs = []
        target_lower = normalize_text(target_text)
        active_prereq_codes = {
            normalize_text(str(item.get('sourceCourseCode', '')))
            for item in target.get('prerequisites', [])
            if str(item.get('sourceCourseCode', '')).strip()
        }
        for match_id, start, end in matcher(target_doc):
            span = target_doc[start:end]
            target_refs.append(span.text)
            matched = reference_index.get(span.text.strip().lower()) or reference_index.get(normalize_text(span.text))
            if matched and matched.get('curriculumCourseId') != target.get('curriculumCourseId') and normalize_text(str(matched.get('courseCode', ''))) not in active_prereq_codes:
                add_candidate(
                    target,
                    matched,
                    'added',
                    f'Exact curriculum reference to {matched.get("courseCode")} detected in target text.',
                    90,
                    ['spacy-phrase'],
                    {'phraseMatch': span.text, 'phraseType': nlp.vocab.strings[match_id]},
                )

        cue_hits = [cue for cue in PREREQ_CUES if cue in target_lower]
        target_manifest_prereqs = []
        if manifest_items:
            manifest_match = next((item for item in manifest_items if normalize_text(str(item.get('courseCode', ''))) == normalize_text(str(target.get('courseCode', ''))) or normalize_text(str(item.get('title', ''))) == normalize_text(str(target.get('title', '')))), None)
            if manifest_match:
                target_manifest_prereqs = manifest_match.get('prerequisites') or []
        manifest_prereq_codes = {normalize_text(str(item.get('sourceCourseCode', ''))): item for item in target_manifest_prereqs if item.get('sourceCourseCode')}

        for prereq in target_manifest_prereqs:
            source = reference_index.get(normalize_text(str(prereq.get('sourceCourseCode', ''))))
            if not source or normalize_text(str(source.get('courseCode', ''))) in active_prereq_codes:
                continue
            add_candidate(
                target,
                source,
                str(prereq.get('edgeKind', 'added')),
                str(prereq.get('rationale', '')).strip() or 'Manifest prerequisite reference',
                96 if str(prereq.get('edgeKind', 'added')) == 'explicit' else 92,
                ['manifest'],
                {'manifestMatch': True},
            )

        if cue_hits:
            for source in items:
                if source.get('curriculumCourseId') == target.get('curriculumCourseId'):
                    continue
                if int(source.get('semesterNumber', 0)) >= int(target.get('semesterNumber', 0)):
                    continue
                source_code = normalize_text(str(source.get('courseCode', '')))
                source_title = normalize_text(str(source.get('title', '')))
                if (source_code in target_lower or source_title in target_lower) and source_code not in active_prereq_codes:
                    add_candidate(
                        target,
                        source,
                        'added',
                        f'Prerequisite cue detected near exact course reference for {source.get("courseCode")}.',
                        88,
                        ['spacy-cue', 'spacy-phrase'],
                        {'cueHits': cue_hits[:4], 'entityMention': source.get('courseCode')},
                    )

    return candidates, warnings


def build_semantic_candidates(items: list[dict[str, Any]]) -> tuple[dict[tuple[str, str], dict[str, Any]], list[str]]:
    warnings: list[str] = []
    candidates: dict[tuple[str, str], dict[str, Any]] = {}
    model, error = load_sentence_transformer()
    if error or model is None:
        warnings.append(f'sentence-transformers unavailable: {error}')
        return candidates, warnings

    texts = [join_text(item) for item in items]
    try:
        embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    except Exception as exc:  # pragma: no cover - runtime environment specific.
        warnings.append(f'embedding generation failed: {exc}')
        return candidates, warnings

    for target_index, target in enumerate(items):
        if int(target.get('semesterNumber', 0)) <= 1:
            continue
        active_prereq_codes = {
            normalize_text(str(item.get('sourceCourseCode', '')))
            for item in target.get('prerequisites', [])
            if str(item.get('sourceCourseCode', '')).strip()
        }
        target_vector = embeddings[target_index]
        scored_sources: list[tuple[float, dict[str, Any]]] = []
        for source_index, source in enumerate(items):
            if source.get('curriculumCourseId') == target.get('curriculumCourseId'):
                continue
            if int(source.get('semesterNumber', 0)) >= int(target.get('semesterNumber', 0)):
                continue
            if normalize_text(str(source.get('courseCode', ''))) in active_prereq_codes:
                continue
            score = cosine_similarity(target_vector, embeddings[source_index])
            if score <= 0:
                continue
            scored_sources.append((score, source))
        scored_sources.sort(key=lambda entry: (-entry[0], int(entry[1].get('semesterNumber', 0)), str(entry[1].get('courseCode', '')).lower()))
        for score, source in scored_sources[:6]:
            if score < 0.16:
                continue
            key = (
                str(target.get('curriculumCourseId', '')).strip(),
                f"{str(source.get('courseCode', '')).strip().lower()}::added",
            )
            rationale = f"Sentence-transformer similarity between {source.get('courseCode')} and {target.get('courseCode')} suggests a prerequisite or carry-over relationship."
            current = candidates.get(key)
            confidence = max(55, min(88, round(score * 100)))
            signal_summary = {
                'semanticOverlap': round(score, 4),
                'embeddingModel': 'all-MiniLM-L6-v2',
            }
            if current:
                if confidence > int(current['confidenceScaled']):
                    current['confidenceScaled'] = confidence
                    current['rationale'] = rationale
                current['sources'] = list(dict.fromkeys([*current['sources'], 'sentence-transformers']))
                current['signalSummary'].update(signal_summary)
                continue
            candidates[key] = {
                'curriculumCourseId': str(target.get('curriculumCourseId', '')).strip(),
                'targetCourseCode': str(target.get('courseCode', '')).strip(),
                'targetTitle': str(target.get('title', '')).strip(),
                'sourceCourseCode': str(source.get('courseCode', '')).strip(),
                'sourceTitle': str(source.get('title', '')).strip(),
                'edgeKind': 'added',
                'rationale': rationale,
                'confidenceScaled': confidence,
                'sources': ['sentence-transformers'],
                'signalSummary': signal_summary,
            }

    return candidates, warnings


def query_ollama(input_payload: dict[str, Any]) -> tuple[list[dict[str, Any]], list[str]]:
    warnings: list[str] = []
    base_url = os.environ.get('AIRMENTOR_OLLAMA_BASE_URL') or os.environ.get('OLLAMA_HOST') or 'http://127.0.0.1:11434'
    model = os.environ.get('AIRMENTOR_CURRICULUM_LINKAGE_OLLAMA_MODEL') or 'qwen2.5:7b-instruct'
    target = input_payload['target']
    candidate_sources = input_payload['candidateSources']
    target_outcomes = ' ; '.join(f"{item['id']}: {item['desc']}" for item in target.get('outcomes', []))
    target_topics = ' ; '.join([
        *target.get('topicPartitions', {}).get('tt1', []),
        *target.get('topicPartitions', {}).get('tt2', []),
        *target.get('topicPartitions', {}).get('see', []),
    ])
    existing_prerequisites = ', '.join(item['sourceCourseCode'] for item in target.get('prerequisites', [])) or 'none'
    prompt_lines = [
        'You are helping curate prerequisite and cross-course linkage proposals for an academic curriculum.',
        'Return strict JSON only, matching the provided schema.',
        'Only suggest source courses from the provided candidate list.',
        'Do not repeat existing prerequisites.',
        'Be conservative. Prefer no proposal over a weak proposal.',
        '',
        f"Target course: {target['courseCode']} | {target['title']} | semester {target['semesterNumber']}",
        f'Target outcomes: {target_outcomes}',
        f'Target topics: {target_topics}',
        f'Existing prerequisites: {existing_prerequisites}',
        '',
        'Candidate sources:',
    ]
    for course in candidate_sources:
        prompt_lines.append(
            f"- {course['courseCode']} | {course['title']} | sem {course['semesterNumber']} | topics {' ; '.join([*course.get('topicPartitions', {}).get('tt1', []), *course.get('topicPartitions', {}).get('tt2', []), *course.get('topicPartitions', {}).get('see', [])])}"
        )
    request = {
        'model': model,
        'prompt': '\n'.join(prompt_lines),
        'stream': False,
        'format': {
            'type': 'object',
            'properties': {
                'proposals': {
                    'type': 'array',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'sourceCourseCode': {'type': 'string'},
                            'edgeKind': {'type': 'string', 'enum': ['explicit', 'added']},
                            'rationale': {'type': 'string'},
                            'confidence': {'type': 'number'},
                        },
                        'required': ['sourceCourseCode', 'edgeKind', 'rationale'],
                    },
                },
            },
            'required': ['proposals'],
        },
        'options': {'temperature': 0},
    }
    try:
        request_bytes = json.dumps(request).encode('utf-8')
        req = urllib.request.Request(
            f"{base_url.rstrip('/')}/api/generate",
            data=request_bytes,
            headers={'content-type': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=6) as response:
            payload = json.loads(response.read().decode('utf-8'))
        parsed = json.loads(payload.get('response') or '{}')
        proposals = parsed.get('proposals') or []
        cleaned: list[dict[str, Any]] = []
        allowed = {str(item['courseCode']).strip().lower(): item for item in candidate_sources}
        for proposal in proposals:
            source_code = str(proposal.get('sourceCourseCode', '')).strip()
            matched = allowed.get(source_code.lower())
            if not matched:
                continue
            cleaned.append({
                'sourceCourseCode': matched['courseCode'],
                'edgeKind': proposal.get('edgeKind', 'added'),
                'rationale': str(proposal.get('rationale', '')).strip() or f"Ollama suggested {matched['courseCode']}.",
                'confidenceScaled': max(40, min(95, round((float(proposal.get('confidence', 0.66)) * 100)))),
                'sources': ['ollama'],
                'signalSummary': {
                    'llmSuggested': True,
                    'llmConfidenceScaled': max(40, min(95, round((float(proposal.get('confidence', 0.66)) * 100)))),
                    'ollamaModel': model,
                },
            })
        return cleaned, warnings
    except Exception as exc:  # pragma: no cover - network/model availability is environment specific.
        warnings.append(f'ollama unavailable: {exc}')
        return [], warnings


def merge_candidates(candidate_maps: list[dict[tuple[str, str], dict[str, Any]]]) -> list[dict[str, Any]]:
    merged: dict[tuple[str, str], dict[str, Any]] = {}
    for candidate_map in candidate_maps:
        for key, value in candidate_map.items():
            current = merged.get(key)
            if not current:
                merged[key] = value
                continue
            if int(value['confidenceScaled']) > int(current['confidenceScaled']):
                current['confidenceScaled'] = value['confidenceScaled']
                current['rationale'] = value['rationale']
                current['edgeKind'] = value['edgeKind']
            current['sources'] = list(dict.fromkeys([*current.get('sources', []), *value.get('sources', [])]))
            signal_summary = dict(current.get('signalSummary', {}))
            signal_summary.update(value.get('signalSummary', {}))
            current['signalSummary'] = signal_summary
    return sorted(
        merged.values(),
        key=lambda item: (-int(item['confidenceScaled']), item['targetCourseCode'], item['sourceCourseCode']),
    )


def select_targets(items: list[dict[str, Any]], target_curriculum_course_ids: list[str] | None):
    if not target_curriculum_course_ids:
        return items
    target_set = {item for item in target_curriculum_course_ids if item}
    return [item for item in items if item.get('curriculumCourseId') in target_set]


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print(json.dumps({'status': 'error', 'warnings': ['empty input'], 'candidates': []}))
        return 1

    try:
        payload = json.loads(raw)
    except Exception as exc:
        print(json.dumps({'status': 'error', 'warnings': [f'invalid json: {exc}'], 'candidates': []}))
        return 1

    items = payload.get('items') or []
    manifest_items = payload.get('manifestItems') or []
    target_ids = payload.get('targetCurriculumCourseIds')
    targets = select_targets(items, target_ids)

    deterministic_candidates, deterministic_warnings = build_phrased_deterministic_candidates(items, manifest_items)
    semantic_candidates, semantic_warnings = build_semantic_candidates(items)

    per_target_candidates: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for candidate_map in (deterministic_candidates, semantic_candidates):
        for candidate in candidate_map.values():
            per_target_candidates[str(candidate['curriculumCourseId'])].append(candidate)

    if payload.get('ollamaBaseUrl') or os.environ.get('AIRMENTOR_OLLAMA_BASE_URL') or os.environ.get('OLLAMA_HOST'):
        for target in targets:
            active_prereq_codes = {
                normalize_text(str(item.get('sourceCourseCode', '')))
                for item in target.get('prerequisites', [])
                if str(item.get('sourceCourseCode', '')).strip()
            }
            target_sources = [
                source for source in items
                if source.get('curriculumCourseId') != target.get('curriculumCourseId')
                and int(source.get('semesterNumber', 0)) < int(target.get('semesterNumber', 0))
                and normalize_text(str(source.get('courseCode', ''))) not in active_prereq_codes
            ]
            llm_candidates, llm_warnings = query_ollama({'target': target, 'candidateSources': target_sources[:8]})
            deterministic_warnings.extend(llm_warnings)
            for candidate in llm_candidates:
                key = (str(target.get('curriculumCourseId', '')).strip(), f"{candidate['sourceCourseCode'].strip().lower()}::{candidate['edgeKind']}")
                current = deterministic_candidates.get(key) or semantic_candidates.get(key)
                if current and int(candidate['confidenceScaled']) <= int(current['confidenceScaled']):
                    continue
                merged = dict(candidate)
                merged['curriculumCourseId'] = str(target.get('curriculumCourseId', '')).strip()
                merged['targetCourseCode'] = str(target.get('courseCode', '')).strip()
                merged['targetTitle'] = str(target.get('title', '')).strip()
                merged['sourceTitle'] = str((next((item for item in items if str(item.get('courseCode', '')).strip().lower() == str(candidate['sourceCourseCode']).strip().lower()), {}) or {}).get('title', '')).strip()
                existing = per_target_candidates[str(target.get('curriculumCourseId', ''))]
                existing.append(merged)

    final_candidates = merge_candidates([{
        (
            str(candidate['curriculumCourseId']).strip(),
            f"{str(candidate['sourceCourseCode']).strip().lower()}::{candidate['edgeKind']}",
        ): candidate
        for candidate in per_target_candidates.get(str(target.get('curriculumCourseId', '')).strip(), [])
    } for target in targets])

    status = 'ok'
    warnings = [*deterministic_warnings, *semantic_warnings]
    if warnings:
        status = 'degraded'

    print(json.dumps({
        'status': status,
        'warnings': warnings,
        'candidates': final_candidates,
    }))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
