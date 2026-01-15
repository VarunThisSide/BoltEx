import {createClient} from "redis";
import { Engine } from "./trade/Engine.js";

async function main(){
    const engine=new Engine();
    const redisClient=createClient()    //dedicated client for consuming from queue, as RedisManager instance is busy producing the message to send
    redisClient.connect()
    while(1){
        const response=await redisClient.brPop('messages' as string,0)
        if(!response){

        }else{
            engine.process(JSON.parse(response))
        }
    }
}

main()