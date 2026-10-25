# Security
- Keep secrets like passwords or api keys local and never commit them to Git, Github or Gitlab
- Use `.env` to store secrets

# Logging and Documentation
- Keep a `log.md` in the repo root about your changes and plans
- Use clear and understandable commit messages

# DEV
- Always create a plan before implementation
- Create scripts or tools where it is helpful and update `AGENTS.md` and `README.md` 
- Follow a test driven development approach
- Add comments in code where useful
- Always run a review sub-agent to review your code
- Fix review findings
- If there are multiple cycles of review and fixing, stop after 4 cycles

# TEST
- Tests live under ./tests
- Always start by creating a unit test before implementation
