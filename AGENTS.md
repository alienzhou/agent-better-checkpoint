<!-- [ABC:agent-better-checkpoint:start] -->
## Checkpoint Commit Rule

After completing any file edit (write_to_file, replace_in_file, multi_replace_in_file, or similar),
you MUST:

1. Load the "agent-better-checkpoint" skill (if not already loaded)
2. Follow its instructions to create a checkpoint commit
3. Do NOT proceed to the next task until the commit is done

This ensures every meaningful code change is tracked with a semantic Git commit.
<!-- [ABC:agent-better-checkpoint:end] -->
