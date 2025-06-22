<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# GitHub Copilot Instructions

## How to use GitHub Copilot in this repository

Before creating new labels, always check existing labels with `gh label list` and review both the label names AND descriptions to find similar or equivalent labels. Look for labels that serve the same purpose even if they have different names (e.g., "ui-ux" vs "user-interface" vs "frontend"). Only create new labels if no existing label adequately covers the concept.

When creating GitHub issues with `gh issue create`, you can tell if the issue was successfully created by looking at the last line of the command output:
- **Success**: The command returns a GitHub URL (e.g., "https://github.com/owner/repo/issues/14")
- **Failure**: The command returns an error message or exits with a non-zero code
- Don't rely on `gh issue list` to check if creation succeeded - use the create command output directly
