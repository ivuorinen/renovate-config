# Renovate configs

[Renovate](https://github.com/renovatebot/renovate) is a tool for automating
dependency updates. This repository contains my personal
Renovate configuration.

This configuration and Renovate creates a single issue in the repository for
tracking all dependency updates. Renovate will automatically update the
issue with new updates and you can force creation and rerunning of the
Renovate bot by checking list items in the issue.

Updates to the configuration are automatically applied to all repositories
that use this configuration. If you want to use this configuration in your
projects you can do so by extending this configuration in your own
in `.github/renovate.json` file.

Please see Renovate configuration documentation to see how you can
extend this configuration to suit your needs.

## Basic usage:

Create a file to `.github/renovate.json` with the following content:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github>ivuorinen/renovate-config"]
}
```

## License

[MIT](LICENSE)
