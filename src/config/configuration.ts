import * as fs from 'fs'
import {Emitter} from "../emitters/emitter"
import {Jsii} from "../emitters/jsii/jsii"
import {GraphQLField, GraphQLSchema, GraphQLType} from "graphql/type"
import path from "node:path";
import {createLogger, format, Logger, transports,} from 'winston';
import {buildClientSchema, buildSchema, getIntrospectionQuery, IntrospectionQuery, printSchema} from "graphql";
import {GraphQLClient} from "graphql-request";


export type EntityConfig = {
   name: string
   create?: string
   update?: string
   delete?: string
   read?: FieldConfig[]
   list?: FieldConfig[]
}

export type FieldConfig = {
   name: string
   type: string
   prune: boolean
   fragmentName?: string
   subFields?: FieldConfig[]
}

class Config {
   useCached: boolean = true
   saveSchema: boolean = true
   schemaFile: string = './schema.gql'
   schemaUrl: string = ' https://api.newrelic.com/graphql'
   licenseKey: string = ''
   logLevel: string = 'info'
   entities: EntityConfig[] = []
   emitters: Emitter[] = []
}

export class Configuration {

   private static instance: Configuration
   public schema?: GraphQLSchema
   private readonly config: Config

   private constructor() {
      this.config = new Config()
      this.setupLogging()
      this.loadSchema()

      // Process config file
      // const buffer = fs.readFileSync("./local/config.yml", 'utf-8')
      // this.config = parse(buffer) as Config
      this.config.logLevel = 'debug'
      this.config.entities = [{
         name: 'dashboards',
         create: 'dashboardCreate',
         update: 'dashboardUpdate',
         delete: 'dashboardDelete',
         read: [{
            name: 'actor',
            type: 'Actor',
            prune: true,
            subFields: [{
               name: 'entity',
               type: 'Entity',
               prune: false,
               subFields: [{
                  name: 'dashboardEntity',
                  type: 'DashboardEntity',
                  prune: false,
                  fragmentName: '... on DashboardEntity'
               }]
            }]
         }],
         list: [{
            name: 'actor',
            type: 'Actor',
            prune: true,
            subFields: [{
               name: 'entitySearch',
               type: 'EntitySearch',
               prune: false,
               subFields: [{
                  name: 'results',
                  type: 'EntitySearchResult',
                  prune: false,
                  subFields: [{
                     name: 'entities',
                     type: 'EntityOutline',
                     prune: false,
                     subFields: [{
                        name: 'dashboardEntityOutline',
                        type: 'DashboardEntityOutline',
                        prune: false,
                        fragmentName: '... on DashboardEntityOutline'
                     }]
                  }]
               }]
            }]
         }]
      }]
      this.config.emitters = this.getEmitters()
      logger.debug('Configuration', this.config)
   }

   public static getInstance(): Configuration {
      if (!Configuration.instance) {
         Configuration.instance = new Configuration()
      }
      return Configuration.instance
   }

   public getEntities(): EntityConfig[] {
      return this.config.entities
   }


   public substituteType(type: GraphQLType | GraphQLField<any, any>): GraphQLType | GraphQLField<any, any> {
      if ('name' in type) {
         // FIXME how do I know the entity?
         if (type.name == 'Entity') {
            const t = this.schema?.getType('')
            if (t == undefined) {
               logger.warn('', type.name)
               return type
            }
            return t
         }
         if (type.name == 'EntityOutline') {
            const t = this.schema?.getType('')
            if (t == undefined) {
               logger.warn('', type.name)
               return type
            }
            return t
         }
         return type
      } else {
         return type
      }
   }

   public getEmitters(): Emitter[] {
      // TODO dynamically load emitters
      // const emitters: Emitter[] = []
      //
      // (async () => {
      //    await new Promise<Emitter>(async (resolve, reject) => {
      //       const e = await import('../emitters/jsii/jsii')
      //       emitters.push((new e()))
      //    })
      //       .catch(err => {
      //          console.log('Oh noes!! Error: ', err.code)
      //       })
      //
      // })()
      // return emitters
      return [new Jsii()]
   }

   private async loadSchema() {
      if (this.config.useCached) {
         // Load the Schema from a file
         if (this.config.schemaFile) {
            const buffer = fs.readFileSync(this.config.schemaFile, 'utf-8')
            this.schema = buildSchema(buffer)
         } else {
            throw new Error(`config: unable to load schema from file: ${this.config.schemaFile}`)
         }
      } else {
         // Load the Schema from the endpoint
         const endpoint: string = this.config.schemaUrl
         let client: GraphQLClient
         client = new GraphQLClient(endpoint, {
            headers: {
               'user-agent': 'JS GraphQL',
               'Content-Type': 'application/json',
               'API-Key': this.config.licenseKey
            },
         },)

         const query: IntrospectionQuery = await client.request(getIntrospectionQuery())
         this.schema = buildClientSchema(query)
         if (this.config.saveSchema) {
            const outputFile = path.join(__dirname, this.config.schemaFile)
            await fs.promises.writeFile(outputFile, printSchema(this.schema))
         }
      }
   }

   private setupLogging() {
      const logFormat = format.combine(
         // colorize must go first
         format.colorize(),
         format.timestamp(),
         format.align(),
         format.simple()
      )
      logger = createLogger({
         format: logFormat,
         level: 'debug',
         transports: [new transports.Console()]
      })

   }
}

export let logger: Logger