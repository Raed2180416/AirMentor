{
  description = "AirMentor UI development shell";

  inputs = {
    nixpkgs.url = "nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            git
            nodejs_24
            python311
            uv
            playwright-test
          ];

          shellHook = ''
            export PLAYWRIGHT_OUTPUT_DIR="$PWD/output/playwright"
            mkdir -p "$PLAYWRIGHT_OUTPUT_DIR"

            echo "AirMentor dev shell ready."
            echo "Playwright is available through the wrapped Nix runtime."
            echo "Python is available for the curriculum linkage helper."
            echo "Try: playwright --version"
            echo "Smoke: bash scripts/playwright-smoke.sh http://127.0.0.1:5173"
          '';
        };
      }
    );
}
