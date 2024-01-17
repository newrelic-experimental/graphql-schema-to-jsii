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
import {parse, stringify} from "yaml";
import {existsSync, mkdirSync} from "node:fs";

export type EntityMutations = Record<string, FieldConfig[]> & {
   create?: FieldConfig[]
   update?: FieldConfig[]
   delete?: FieldConfig[]
}

export type EntityQueries = Record<string, FieldConfig[]> & {
   read?: FieldConfig[]
   list?: FieldConfig[]
}

// This bit if magic (the &) lets us dynamically add fields to the EntityConfig that are of type FieldConfig[]
// This lets us add mutations that don't fit into the CRUDL notion, dashboardAddWidgetsToPage for instance
export type EntityConfig = Record<string, FieldConfig[]> & {
   name: string
   mutations?: EntityMutations
   queries?: EntityQueries
}

export type FieldConfig = {
   name: string
   type: string
   prune: boolean
   fragmentName?: string
   subFields?: FieldConfig[]
}


export type Options = Record<string, any> & {
   useCached: boolean
   saveSchema: boolean
   schemaFile: string
   schemaUrl: string
   licenseKey: string
   logLevel: string
   outputDir: string
}

const defaultOptions: Options = {
   licenseKey: '',
   logLevel: 'info',
   outputDir: './generated/',
   saveSchema: false,
   schemaFile: './schema.gql',
   schemaUrl: 'https://api.newrelic.com/graphql',
   useCached: true,
}

class Config {
   options: Options = defaultOptions
   entities: EntityConfig[] = []
   emitters: Emitter[] = []
}

export class Configuration {
   private static instance: Configuration
   public schema?: GraphQLSchema

   private readonly config: Config

   private constructor() {
      // DIRE WARNING- this all works because the Option names are CONSISTENT

      // Setup the configFile's name
      // Default
      let configFile = './config.yml'
      // envvar override
      if (process.env.GSTJ_CONFIGFILE) {
         configFile = process.env.GSTJ_CONFIGFILE
         configFile = process.env.GSTJ_CONFIGFILE
      }

      // Load command line, this is "early" in precedence but we need the configFile setting https://github.com/tj/commander.js
      const commandLine = new Command()
      commandLine
         .option('-c, --configFile <string>', 'path to yaml configuration file')
         .option('-l, --logLevel <string>', 'logging level')
         .option('-k, --licenseKey <string>', 'Introspection license key')
         .option('-o, --outputDir <string>', 'Output directory')
      // Don't fail when running jest
      commandLine.exitOverride()
      try {
         commandLine.parse(process.argv)
      } catch (err) {
      }
      const commandLineOptions = commandLine.opts()

      // configFile override from command line
      if (commandLineOptions.configFile) {
         configFile = commandLineOptions.configFile
      }

      // Load config file
      if (!fs.existsSync(configFile)) {
         console.error(`Configuration file is required! config file: ${configFile} not found. Exiting.`)
         process.exit(1)
      }
      const buffer = fs.readFileSync(configFile, 'utf-8')
      this.config = parse(buffer) as Config
      if (!this.config) {
         console.error(`Empty or invalid config file: ${configFile}. Exiting.`)
         process.exit(1)
      }
      // If the user has an an empty Options provide one from the defaults
      if (!this.config.options) {
         this.config.options = defaultOptions
      }

      // Default any missing config file options
      const optionKeys = Object.getOwnPropertyNames(defaultOptions)
      for (const optionKey of optionKeys) {
         if (optionKey in this.config.options && this.config.options[optionKey]) {
            continue
         } else {
            this.config.options[optionKey] = defaultOptions[optionKey]
         }
      }

      // Override from envvars
      for (const optionKey of optionKeys) {
         const envOption = process.env['GSTJ_' + optionKey.toUpperCase()]
         if (envOption) {
            this.config.options[optionKey] = envOption
         }
      }

      // Override from command line
      for (const optionKey of optionKeys) {
         if (commandLineOptions[optionKey]) {
            this.config.options[optionKey] = commandLineOptions[optionKey]
         }
      }

      // This must happen last
      this.setupLogging()
      this.loadSchema()
      if (!existsSync(this.config.options.outputDir)) {
         mkdirSync(this.config.options.outputDir)
      }
      this.config.emitters = this.getEmitters()
      logger.debug('Configuration', this.config)
      console.log(stringify(this.config))
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
      return [new Jsii(this.config.options.outputDir)]
   }

   private async loadSchema() {
      if (this.config.options.useCached) {
         // Load the Schema from a file
         if (this.config.options.schemaFile) {
            const buffer = fs.readFileSync(this.config.options.schemaFile, 'utf-8')
            this.schema = buildSchema(buffer)
         } else {
            throw new Error(`config: unable to load schema from file: ${this.config.options.schemaFile}`)
         }
      } else {
         // Load the Schema from the endpoint
         const endpoint: string = this.config.options.schemaUrl
         let client: GraphQLClient
         client = new GraphQLClient(endpoint, {
            headers: {
               'user-agent': 'JS GraphQL',
               'Content-Type': 'application/json',
               'API-Key': this.config.options.licenseKey
            },
         },)

         const query: IntrospectionQuery = await client.request(getIntrospectionQuery())
         this.schema = buildClientSchema(query)
         if (this.config.options.saveSchema) {
            const outputFile = path.join(__dirname, this.config.options.schemaFile)
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
         level: this.config.options.logLevel,
         transports: [new transports.Console()]
      })

   }
}

export let logger: Logger