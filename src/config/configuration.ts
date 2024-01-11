#!/usr/bin/env node --require ts-node/register
import * as fs from 'fs'
import {Emitter} from "../emitters/emitter"
import {Jsii} from "../emitters/jsii/jsii"
import {GraphQLSchema} from "graphql/type"
import path from "node:path";
import {createLogger, format, Logger, transports,} from 'winston';
import {buildClientSchema, buildSchema, getIntrospectionQuery, IntrospectionQuery, printSchema} from "graphql";
import {GraphQLClient} from "graphql-request";
import {Command} from "commander";
import {parse} from "yaml";


export type EntityConfig = {
   name: string
   create?: FieldConfig[]
   update?: FieldConfig[]
   delete?: FieldConfig[]
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
   schemaUrl: string = 'https://api.newrelic.com/graphql'
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

      // Let comannderjs handle the command line https://github.com/tj/commander.js
      const program = new Command()
      program
         .option('-c, --configFile <string>', 'path to yaml configuration file')
         .option('-l, --logLevel <string>', 'logging level')
         .option('-k, --licenseKey <string>', 'Introspection license key')

      // Don't fail when running jest
      program.exitOverride()
      try {
         program.parse(process.argv)
      } catch (err) {
      }
      const options = program.opts()

      // Try envvars if no command line options
      const envConfig = process.env['GSTJ_CONFIG']
      if (!options.configFile) {
         if (!envConfig) {
            options.configFile = './config.yml'
         } else {
            options.configFile = envConfig
         }
      }
      const envLogLevel = process.env['GSTJ_LOGLEVEL']
      if (!options.logLevel) {
         if (envLogLevel) {
            options.logLevel = envLogLevel
         }
      }
      const envLicenseKey = process.env['GSTJ_LICENSEKEY']
      if (!options.licenseKey) {
         if (envLicenseKey) {
            options.licenseKey = envLicenseKey
         }
      }

      // Process config file
      if (!fs.existsSync(options.configFile)) {
         console.error(`Configuration file is required! config file: ${options.configFile} not found. Exiting.`)
         process.exit(1)
      }
      const buffer = fs.readFileSync(options.configFile, 'utf-8')
      this.config = parse(buffer) as Config
      if (!this.config) {
         console.error(`Empty or invalid config file: ${options.configFile}. Exiting.`)
         process.exit(1)
      }

      // Config file overrides
      if (options.logLevel) {
         this.config.logLevel = options.logLevel
      }
      if (options.licenseKey) {
         this.config.licenseKey = options.licenseKey
      }

      // This must happen after config file loading
      this.setupLogging()
      this.loadSchema()
      this.config.emitters = this.getEmitters()
      logger.debug('Configuration', this.config)
      //console.log(stringify(this.config))
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
         level: this.config.logLevel,
         transports: [new transports.Console()]
      })

   }
}

export let logger: Logger