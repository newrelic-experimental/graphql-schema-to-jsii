// @ts-ignore

import * as fs from "fs"
import * as path from "node:path"
import {
   buildClientSchema,
   buildSchema,
   getIntrospectionQuery,
   GraphQLField,
   GraphQLFieldMap,
   GraphQLInputFieldMap,
   GraphQLList,
   GraphQLObjectType,
   GraphQLSchema,
   GraphQLType,
   IntrospectionQuery,
   printSchema
} from "graphql"
import {GraphQLClient} from 'graphql-request'
import {Configuration} from './src/config/configuration'
import {
   GraphQLEnumType,
   GraphQLInputObjectType,
   GraphQLInterfaceType,
   GraphQLNonNull,
   GraphQLScalarType,
   GraphQLUnionType
} from "graphql/type/definition";

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
      config.setPathType('query')
      const fields = queries.getFields()
      if (fields) {
         for (let fieldsKey in fields) {
            const groupName = config.captureQuery(fieldsKey)
            if (groupName) {
               let group = groups.get(groupName)
               if (!group) {
                  group = new Group()
                  group.name = groupName
                  groups.set(groupName, group)
               }
               const field = fields[fieldsKey]
               group.queries.push(field)
               splunk(field, group.types, field.name)
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