with open('src/db/schema.ts', 'r') as f:
    content = f.read()

# Replace courseTopicPartitions with curriculumTopics in allTables
content = content.replace("  courseTopicPartitions,\n", "  curriculumTopics,\n  curriculumCourseOutcomes,\n  curriculumGraphDrafts,\n  curriculumGraphHistory,\n  curriculumGraphSuggestions,\n")

with open('src/db/schema.ts', 'w') as f:
    f.write(content)
