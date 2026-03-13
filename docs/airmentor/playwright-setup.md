# Playwright On NixOS

AirMentor uses a Nix-based Playwright runtime on this machine.

Why:

- this host is NixOS
- raw `npx playwright-cli` browser launches fail because the expected distro-style shared libraries are not available in the normal host path
- the wrapped `playwright` runtime from `nixpkgs#playwright-test` works correctly in a Nix shell and can render the app headlessly

## Standard Setup

Enter the repo dev shell:

```bash
nix develop
```

Inside the shell, Playwright is ready to use:

```bash
playwright --version
```

## Smoke Check

Start the app in one terminal:

```bash
npm run dev -- --host 127.0.0.1
```

Then capture a headless Firefox screenshot in another terminal:

```bash
bash scripts/playwright-smoke.sh http://127.0.0.1:5173
```

If port `5173` is busy, pass the actual Vite URL instead.

Default output location:

```text
output/playwright/smoke-firefox.png
```

You can also pass a custom output path:

```bash
bash scripts/playwright-smoke.sh http://127.0.0.1:5174 output/playwright/login.png
```

## Workflow Contract

- use `nix develop` as the standard browser-capable environment for this repo
- use the wrapped `playwright` binary from the dev shell
- prefer headless screenshots and scripted page-walks for the page-by-page UI audit in this environment
- do not use raw `npx playwright install --with-deps` as the default NixOS setup path

## Useful Commands

Version check:

```bash
nix develop -c playwright --version
```

Direct screenshot without the helper script:

```bash
nix develop -c playwright screenshot -b firefox --wait-for-timeout 1000 http://127.0.0.1:5173 /tmp/airmentor-playwright-smoke.png
```
