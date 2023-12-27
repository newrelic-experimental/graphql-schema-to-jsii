import * as fs from 'fs'
import {parse} from 'yaml'
import {Command} from 'commander'
import {Emitter} from "../emitters/emitter";
import {Jsii} from "../emitters/jsii/jsii";

// @ts-ignore
class params {
   schema?: {
      fromCache: boolean
      cacheFile: string
      endpoint: string
      licenseKey: string
   }
   emitters?: string[]
   mutations?: string[]
   queries?: string[]
}


// TODO Command line
// TODO Config file
type schemaMeta = {
   fromCache: boolean;
   cacheFile: string;
   endpoint: string;
   licenseKey: string;
}

type Entity = {
   name: string
   queries: string[]
}
type Config = {
   schema: schemaMeta
   entities: Entity[]
   emitters: string[]
}

// TODO Language (emitter) plugins
export class Configuration {
   private static instance: Configuration
   // @ts-ignore
   private config: Config
   private pathType: string = ''

   private constructor() {
      // https://github.com/tj/commander.js
      const program = new Command()
      program
         .option('-f, --configFile', 'path to yaml configuration file', './config.yml')
         .option('-e, --emitters', 'path to language emitters', ['./src/emitters/jsii/jsii.ts'])
         .option('-m, --mutations', 'list of mutations to process', ['./src/emitters/jsii/jsii.ts'])
         .option('-q, --queries', 'list of  queries to process', ['./src/emitters/jsii/jsii.ts'])

      // Don't fail when running jest
      program.exitOverride();
      try {
         program.parse(process.argv);
      } catch (err) {
      }

      // @ts-ignore
      const options = program.opts()
      // this.config = new params()


      // Process config file
      // TODO
      const buffer = fs.readFileSync("./local/config.yml", 'utf-8')
      this.config = parse(buffer) as Config
      // envvar overrides
      // command line overrides
      console.log(this.config)
   }

   public static getInstance(): Configuration {
      if (!Configuration.instance) {
         Configuration.instance = new Configuration()
      }
      return Configuration.instance
   }

   public getLicenseKey(): string {
      return this.config.schema.licenseKey
   }

   public cached(): boolean {
      return this.config.schema.fromCache
   }

   public schemaFile(): string {
      return this.config.schema.cacheFile
   }

   public saveSchema(): boolean {
      return true;
   }

   public captureMutation(mutation: string): string | null {
      let result: string | null = null
      this.config.entities.forEach((entity) => {
         if (mutation.startsWith(entity.name.toLowerCase())) {
            result = entity.name
            return
         }
      })
      return result
   }

   public captureQuery(query: string): string | null {
      let result: string | null = null
      this.config.entities.forEach((entity) => {
         entity.queries.forEach((q) => {
            if (q.startsWith(query)) {
               result = query
               return
            }
         })
      })
      return result
   }

   public setPathType(type: string) {
      this.pathType = type
   }

   public inPath(path: string): boolean {
      if (this.pathType == 'mutation') {
         return this.inMutationPath(path)
      } else {
         return this.inQueryPath(path)
      }
   }

   //@ts-ignore
   public inMutationPath(path: string = ''): boolean {
      // By definition true- we're capture the mutation so the path is always valid
      return true
   }

   public inQueryPath(path: string): boolean {
      // In-case we've accumulated array and non-null indicators
      path = path.replaceAll('[', '').replaceAll(']', '').replaceAll(']', '')
      let result = false
      // First test the prefix
      const pathChunks = path.split('.')
      // FIXME revert this code to nested functions and then short circuit success with an "exception"
      outer: for (let ii = 0; ii < this.config.entities.length; ii++) {
         for (let iii = 0; iii < this.config.entities[ii].queries.length; iii++) {
            const queryChunks = this.config.entities[ii].queries[iii].split('.')
            for (let i = 0; i < pathChunks.length && i < queryChunks.length; i++) {
               if (pathChunks[i] == queryChunks[i]) {
                  result = true
               } else {
                  result = false
                  break
               }
            }
            if (result) {
               break outer
            }
         }
      }
      if (result) {
         // Prefix passed, now let's see if the path has an Entity
         if (path.endsWith('Entity') || path.endsWith('Entity.') || path.endsWith('EntityOutline') || path.endsWith('EntityOutline.')) {
            result = false
            this.config.entities.forEach((entity) => {
               if (path.includes(entity.name)) {
                  result = true
                  return
               }
            })
         } else {
            // No entity, passes
            result = true
         }
      }
      return result
   }

   public getEmitters(): Emitter[] {
      // TODO dynamically load emitters
      // const emitters: Emitter[] = [];
      //
      // (async () => {
      //    await new Promise<Emitter>(async (resolve, reject) => {
      //       const e = await import('../emitters/jsii/jsii')
      //       emitters.push((new e()))
      //    })
      //       .catch(err => {
      //          console.log('Oh noes!! Error: ', err.code)
      //       });
      //
      // })()
      // return emitters
      return [new Jsii()]
   }
}