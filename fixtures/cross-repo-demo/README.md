# Cross-Repo Demo

This fixture models a source app handing current shipped state to a marketing workspace.

```bash
notch --cwd fixtures/cross-repo-demo/source-app doctor --fix --yes
notch --cwd fixtures/cross-repo-demo/destination-marketing doctor --fix --yes
notch --cwd fixtures/cross-repo-demo/destination-marketing packet list --inbox
```

The source app owns the packet in `.notch/outbox/`. The destination workspace owns the imported copy in `.notch/inbox/`.
