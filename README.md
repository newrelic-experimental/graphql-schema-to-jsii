# GraphQL Schema To JSII TypeScript

Given a [GraphQL Schema](https://graphql.org/learn/schema/) generate  [JSII compliant TypeScript](https://aws.github.io/jsii/user-guides/lib-author/typescript-restrictions/) type and document (query and mutation) definitions for the
specified entities.

## Motivation

There are a several tools for generating TypeScript from a GraphQL Schema, however to date none generate [JSII compliant TypeScript](https://aws.github.io/jsii/user-guides/lib-author/typescript-restrictions/).

JSII compatibility gives us cross-language (C#, Java, Python, Go) cabability when writing [Cloud Development Kit (CDK)](https://aws.amazon.com/cdk/) [Constructs](https://constructs.dev/).

## Installation

```bash
git clone git@github.com:newrelic-experimental/graphql-schema-to-jsii.git
cd graphql-schema-to-jsii
npm install
```

## Use

```bash
node --require ts-node/register index.ts 
```

## Configuration

Configuration uses the following precedence order. Each item takes precedence over the item below it:

- command line
- environment variables
- configuration file
- defaults

### Command line

| Short flag | Long flag      | Description                     | Default      |
|------------|----------------|---------------------------------|--------------|
| `-c`       | `--configFile` | path to yaml configuration file | ./config.yml |
| `-l`       | `--logLevel`   | logging  level                  |              |
| `-k`       | `--licenseKey` | Introspection  license key      |              |

Example:

```bash
npx tsc ; node index.js --configFile local/config.yml --logLevel debug
```

### Environment variables

envvars _must be_ uppercase

| envvar             | Description                     | Default |
|--------------------|---------------------------------|---------|
| `GSTJ_CONFIG`      | path to yaml configuration file |         |
| `GSTJ_LICENSE_KEY` | Introspection  license key      |         |
| `GSTJ_LOGLEVEL`    | logging  level                  |         |

Example:

```bash
npx tsc ; GSTJ_CONFIG=local/config.yml GSTJ_LOGLEVEL=debug  node index.js 
```

### Configuration file (yaml)

| key        | type    | default                          |
|------------|---------|----------------------------------|
| licenseKey | string  |                                  |
| logLevel   | string  | info                             |
| saveSchema | boolean | true                             |
| schemaFile | string  | ./schema.gql                     |
| schemaUrl  | string  | https://api.newrelic.com/graphql |
| useCached  | boolean | true                             |

[See comments in config.samply.yml for Entity configuration](./config.sample.yml)

### Defaults

| key        | type   | default      |
|------------|--------|--------------|
| configFile | string | ./config.yml |
| logLevel   | string | info         |

## Helpful reading

- [GraphQL Schema](https://graphql.org/learn/schema/)
- [JSII TypeScript restrictions](https://aws.github.io/jsii/user-guides/lib-author/typescript-restrictions/)

## To do

- Normalize Create, Update, Delete, Read, and List operation names via configuration
- Generate a skeleton config file from the schema (?)
- Extend the `emitter` concept