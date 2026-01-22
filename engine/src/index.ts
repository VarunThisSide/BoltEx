import {createClient} from "redis";
import { Engine } from "./trade/Engine.js";
import express from "express";

const app=express()
const PORT = process.env.PORT || 3000; 
app.get('/health', (req, res) => res.send('Engine is running'));
app.listen(PORT, () => console.log(`Health check listening on ${PORT}`));

async function main(){
    const engine=new Engine();
    const redisClient=createClient({
            username : 'default',
            password : process.env.REDIS_PASSWORD || '',
            socket : {
                host: process.env.REDIS_HOST,
                port: 12819
            }
        })    //dedicated client for consuming from queue, as RedisManager instance is busy producing the message to send
    redisClient.connect()
    while(1){
        const response=await redisClient.rPop('messages' as string)
        if(!response){

        }else{
            engine.process(JSON.parse(response))
        }
    }
}

main()