// @ts-ignore

import * as fs from "fs"
import * as path from "node:path"
import {buildClientSchema, buildSchema, getIntrospectionQuery, GraphQLField, GraphQLFieldMap, GraphQLInputFieldMap, GraphQLList, GraphQLObjectType, GraphQLSchema, GraphQLType, IntrospectionQuery, printSchema} from "graphql"
import {GraphQLClient} from 'graphql-request'
import {Configuration} from './src/config/configuration'
import {argsToArgsConfig, GraphQLEnumType, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLNonNull, GraphQLScalarType, GraphQLUnionType} from "graphql/type/definition";

const config = Configuration.getInstance()

// TODO Make this a "command"
async function main() {
   let schema: GraphQLSchema

   if (config.cached()) {
      // Load the Schema from a file
      const schemaFile = config.schemaFile()
      if (schemaFile) {
         const buffer = fs.readFileSync(schemaFile, 'utf-8')
         schema = buildSchema(buffer)
      } else {
         return
      }
   } else {
      // Load the Schema from the endpoint
      const endpoint: string = 'https://api.newrelic.com/graphql'
      let client: GraphQLClient
      client = new GraphQLClient(endpoint, {
         headers: {
            'user-agent': 'JS GraphQL',
            'Content-Type': 'application/json',
            'API-Key': config.getLicenseKey(),
         },
      },)

      const query: IntrospectionQuery = await client.request(getIntrospectionQuery())
      schema = buildClientSchema(query)
      config.setSchema(schema)
      if (config.saveSchema()) {
         const outputFile = path.join(__dirname, config.schemaFile())
         await fs.promises.writeFile(outputFile, printSchema(schema))
      }

   }

   const groups: Map<string, Group> = new Map();

   const mutations = schema.getMutationType()
   if (mutations) {
      config.setPathType('mutation')
      const fields = mutations.getFields()
      if (fields) {
         for (let fieldsKey in fields) {
            const groupName = config.captureMutation(fieldsKey)
            if (groupName) {
               let group = groups.get(groupName)
               if (!group) {
                  group = new Group()
                  groups.set(groupName, group)
               }
               const field = fields[fieldsKey]
               group.mutations.push(field)
               splunk(field, group.types, field.name)
            }
         }
      }
   }

   // TODO include <entity>Entity and <entity>EntityOutline types, replace Entity and EntityOutline with them
   const queries = schema.getQueryType()
   if (queries) {
      config.setPathType('mutation')
      const fields = queries.getFields()
      if (fields) {
         for (let fieldsKey in fields) {
            const field = fields[fieldsKey]
            const groupName = config.captureQuery(fieldsKey)
            if (groupName) {
               let group = groups.get(groupName)
               if (!group) {
                  group = new Group()
                  group.name = groupName
                  groups.set(groupName, group)
               }
               // This is two problems:
               // 1. We need our own, trimmed, Actor type with a single field of Entity for type definitions
               // 2. During document generation we need to include the DashboardEntity fragment at the end of the Entity
               // const entity = schema.getType('Entity')
               // if (entity != undefined && entity instanceof GraphQLInterfaceType) {
               //    const dbe = schema.getType('DashboardEntity')
               //    if (dbe != undefined && dbe instanceof GraphQLObjectType) {
               //       const entityConfig = entity.toConfig()
               //       entityConfig.fields['DashboardEntity'] = {type: dbe}
               //       const myEntity = new GraphQLInterfaceType(entityConfig)
               //       // @ts-ignore
               //       const myActor = new GraphQLObjectType({
               //          name: 'actor',
               //          fields: {
               //             entity: {type: myEntity,},
               //          }
               //       });

               const myActor = buildField(schema, field)
               if (myActor != null) {
                  splunk(myActor, group.types, myActor.name)
                  group.queries.push(myActor)
               }
               //    }
               //}
               // splunk(field, group.types, field.name)
            }
         }
      }
   }

   for (let emitter of config.getEmitters()) {
      groups.forEach((v, k) => {
         emitter.emit(k, v)
      })
   }
}

// Type names must start with uppercase
// Field names must start with lowercase
// Both must be camelcase
function buildField(schema: GraphQLSchema, actor: GraphQLField<any, any>): GraphQLField<any, any> | null {
   const dbe = schema.getType('DashboardEntity')
   const entity = schema.getType('Entity')
   if (dbe == undefined || !(dbe instanceof GraphQLObjectType) || entity == undefined || !(entity instanceof GraphQLInterfaceType)) {
      return null
   }
   const entityConfig = entity.toConfig()
   entityConfig.fields['dashboardEntity'] = {extensions: {FRAGMENTNAME: '... on DashboardEntity'}, type: dbe}
   const myEntity = new GraphQLInterfaceType(entityConfig)
   const originalActor = actor.type
   if (!(originalActor instanceof GraphQLObjectType)) {
      return null
   }
   const originalEntityField = originalActor.getFields()['entity']
   const entityField = {
      description: originalEntityField.description,
      type: myEntity,
      args: argsToArgsConfig(originalEntityField.args),
      resolve: originalEntityField.resolve,
      subscribe: originalEntityField.subscribe,
      deprecationReason: originalEntityField.deprecationReason,
      extensions: originalEntityField.extensions,
      astNode: originalEntityField.astNode,
   }

   const trimmedActor = new GraphQLObjectType({
      name: 'Actor',
      fields: {
         entity: entityField,
      }
   });

   const trimmedActorField = {
      name: actor.name,
      description: actor.description,
      type: trimmedActor,
      args: actor.args,
      resolve: actor.resolve,
      subscribe: actor.subscribe,
      deprecationReason: actor.deprecationReason,
      extensions: actor.extensions,
      astNode: actor.astNode,
   }
   return trimmedActorField
}

function isGraphQLField(a: any): a is GraphQLField<any, any> {
   return ('name' in a && 'description' in a && 'type' in a && 'args' in a && 'deprecationReason' in a && 'extensions' in a && 'astNode' in a)
}

function splunkFields(fields: GraphQLFieldMap<any, any> | GraphQLInputFieldMap, types: Map<string, GraphQLType>, path: string) {
   for (let fieldsKey in fields) {
      splunk(fields[fieldsKey].type, types, path + '.' + fieldsKey)
   }
}

function splunkInterfaces(interfaces: ReadonlyArray<GraphQLInterfaceType>, types: Map<string, GraphQLType>, path: string) {
   interfaces.forEach((i) => {
      splunk(i, types, path + '.' + i.name)
   })
}

function splunkTypes(typeArray: ReadonlyArray<GraphQLObjectType>, types: Map<string, GraphQLType>, path: string) {
   typeArray.forEach((t) => {
      splunk(t, types, path + '.' + t.name)
   })
}

function splunk(type: GraphQLType | GraphQLField<any, any>, types: Map<string, GraphQLType>, path: string) {
   //function splunk(type: GraphQLType | GraphQLField<any, any>, types: Map<string, GraphQLType>, path: string, path: string, inPath: (entity:string, path:string)=>boolean) {
   if (('deprecationReason' in type) && type.deprecationReason != undefined) {
      return
   }

   const inPath = config.inPath(path)
   if (!inPath) {
      return
   }

   if (type instanceof GraphQLScalarType) {
      types.set(type.name, type)

   } else if (type instanceof GraphQLObjectType) {
      types.set(type.name, type)
      splunkFields(type.getFields(), types, path)

   } else if (type instanceof GraphQLInterfaceType) {
      types.set(type.name, type)
      splunkFields(type.getFields(), types, path)
      splunkInterfaces(type.getInterfaces(), types, path)

   } else if (type instanceof GraphQLUnionType) {
      types.set(type.name, type)
      splunkTypes(type.getTypes(), types, path)

   } else if (type instanceof GraphQLEnumType) {
      // GraphQL Enums are lists of strings, nothing else to do here
      types.set(type.name, type)

   } else if (type instanceof GraphQLNonNull) {
      // Wrapper for a required field
      splunk(type.ofType, types, path)

   } else if (type instanceof GraphQLInputObjectType) {
      types.set(type.name, type)
      splunkFields(type.getFields(), types, path)

   } else if (type instanceof GraphQLList) {
      // Wrapper for a list
      splunk(type.ofType, types, path)

      // Case of almost last resort
   } else if (isGraphQLField(type)) {
      // Weird special case
      if (type.name == path) {
         splunk(type.type, types, path)
      } else {
         splunk(type.type, types, path + '.' + type.name)
      }
      //splunk(type.type, types, path + '.' + type.name)
      type.args.forEach((arg) => {
         splunk(arg.type, types, path)
      })

   } else {
      console.error("Unknown type: ", type)
   }
   return
}

export class Group {
   name: string = ''
   mutations: GraphQLField<any, any>[] = []
   queries: GraphQLField<any, any>[] = []
   types: Map<string, GraphQLType> = new Map();
}

main()