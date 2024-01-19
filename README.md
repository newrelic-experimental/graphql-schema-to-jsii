# GraphQL Schema To JSII TypeScript

Given a [GraphQL Schema](https://graphql.org/learn/schema/) generate  [JSII compliant TypeScript](https://aws.github.io/jsii/user-guides/lib-author/typescript-restrictions/) type and document (query and mutation) definitions for the
specified entities.

## Motivation

There are a several tools for generating TypeScript from a GraphQL Schema, however to date none generate [JSII compliant TypeScript](https://aws.github.io/jsii/user-guides/lib-author/typescript-restrictions/).

JSII compatibility gives us cross-language (C#, Java, Python, Go) capability when writing [Cloud Development Kit (CDK)](https://aws.amazon.com/cdk/) [Constructs](https://constructs.dev/).

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

See [tagging.yml](./config-samples/tagging.yml) for a commented, working, sample

### Configuration file location

Path and name of the yaml configuration file. Relative paths are ok

- Default: `./config.yml`
- envvar: `GSTJ_CONFIGFILE`
- Command line: `--configFile`

### Options

| Option (yaml) | Default                          | Description                                  | Command line | envvar          |
|---------------|----------------------------------|----------------------------------------------|--------------|-----------------|
| licenseKey    |                                  | GraphQL introspection endpoint license key   | --licenseKey | GSTJ_LICENSEKEY |
| logLevel      | info                             | error, warn, info, verbose, debug            | --logLevel   | GSTJ_LOGLEVEL   |
| outputDir     | ./generated/                     | Output directory                             | --outputDir  | GSTJ_OUTPUTDIR  |
| saveSchema    | false                            | Whether or not to save the GraphQL schema    | --saveSchema | GSTJ_SAVESCHEMA |
| schemaFile    | ./schema.gql                     | Name and location of GraphQL schema file     | --schemaFile | GSTJ_SCHEMAFILE |
| schemaUrl     | https://api.newrelic.com/graphql | GraphQL introspection endpoint               | --schemaUrl  | GSTJ_SCHEMAURL  |
| useCached     | true                             | Skip introspection and use saved schema file | --useCached  | GSTJ_USECACHED  |

Command line example:

```bash
npx tsc ; node index.js --configFile local/config.yml --logLevel debug
```

envvar example:

```bash
npx tsc ; GSTJ_CONFIGFILE=local/config.yml GSTJ_LOGLEVEL=debug  node index.js 
```

### Mutation and Query configuration

#### entities

Each configuration file defines one or more `entities`. An `entity` is a logical grouping that has no relationship to the schema, they are for organizational purposes. In yaml `entities` is an array of `entity` objects.

##### entity

An `entity` object defines a logical grouping of mutations and queries and their required types.

- `name`: the name of this group. The `name` provides the prefix for output files and the suffix for `gql` documents.
- `mutations`: a yaml object whose properties define the mutations to generate
- `queries`: a yaml object whose properties define the queries to generate

Each query or mutation object consists of a

- property name:  This is a good place to normalize operations. `create`, `update`, `delete`, `read`, and `list` are highly recommended but not required.
- an array of field definition objects:
    - name: the name of the field as defined in the schema
    - type: the GraphQL schema type of this field
    - prune: (true | false) remove all but the `subFields` specified fields from this object
    - fragmentName: use this string rather than the `name` as part of the mutation/query. Useful for embedding fragments
    - subFields: an array of field definition objects defining subFields

This example fragment (from [dashboards.yml](./config-samples/dashboards.yml))

```yaml
    queries:
      read:
        - name: actor
          type: Actor
          prune: true
          subFields:
            - name: entity
              type: Entity
              prune: false
              subFields:
                - name: dashboardEntity
                  type: DashboardEntity
                  prune: false
                  fragmentName: ... on DashboardEntity
```

results in

```
export const ReadDashboards = gql`
    query ReadDashboards (  $guid: EntityGuid!, $filter: [ String ], ... MANY Parameters ...
        actor  {
            entity (  guid: $guid, ) {
                account  {

                ... Roughly 500 lines of GraphQL ...

                type
                ... on DashboardEntity  {
                    ... lots more GraphQL ...
```

##### NOTES

- The top-level field definition (`read:` above) may contain only _one_ field definition, this is enforced by the code
- `subFields` may contain `1..n` subfield definitions

## Output

Each configured entity results in a file `./local/<entity>-types.ts` that contains:

- `gql` documents
    - `Create<Entity>`
    - `Update<Entity>`
    - `Delete<Entity>`
    - `Read<Entity>`
    - `List<Entity>`
- All types required to support the mutations and queries.

## Helpful reading

- [GraphQL Schema](https://graphql.org/learn/schema/)
- [JSII TypeScript restrictions](https://aws.github.io/jsii/user-guides/lib-author/typescript-restrictions/)

## To do

- Everything should get its own file in an `entity` subfolder of `outputDir`. (types, docs, clients, ...)
- Generate a skeleton config file from the schema (?)
- Extend the `emitter` concept
    - Emit a working `Construct`