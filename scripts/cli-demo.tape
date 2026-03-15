Output docs/assets/demo.gif

Set Theme "Dracula"
Set FontSize 13
Set Width 720
Set Height 440
Set PlaybackSpeed 1.25
Set Shell "bash"

# Setup
Type "export PATH=/opt/homebrew/bin:$PATH"
Enter
Sleep 100ms
Type "alias mcp-workbench='node apps/cli/dist/index.js'"
Enter
Sleep 100ms
Type "clear"
Enter
Sleep 400ms

# ─── Part 1: inspect ─────────────────────────────────────────────────────────
Type "mcp-workbench inspect --command node --args 'examples/demo-server/dist/index.js'"
Enter
Sleep 6s

Sleep 2s
Type "clear"
Enter
Sleep 400ms

# ─── Part 2: run tests ───────────────────────────────────────────────────────
Type "mcp-workbench run examples/fixtures/demo-server.yaml --verbose"
Enter
Sleep 8s

Sleep 3s
