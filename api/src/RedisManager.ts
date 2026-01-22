import { createClient, type RedisClientType } from "redis";
import type { MessageFromOrderbook, MessageToEngine } from "./types/index.js";

//singleton class
export class RedisManager{
    private publisher : RedisClientType     //made for redis queues (publish an action to engine)
    private client : RedisClientType    //made for redis pub subs (client for engine)
    private static instance : RedisManager
    private constructor(){
        this.client=createClient({
            username : 'default',
            password : process.env.REDIS_PASSWORD || '',
            socket : {
                host: process.env.REDIS_HOST,
                port: 12819
            }
        })
        this.publisher=createClient({
            username : 'default',
            password : process.env.REDIS_PASSWORD || '',
            socket : {
                host: process.env.REDIS_HOST,
                port: 12819
            }
        })
        this.client.connect()
        this.publisher.connect()
    }
    public static getInstance(){
        if(!this.instance){
            return this.instance=new RedisManager()
        }else{
            return this.instance
        }
    }
    public sendAndAwait(message : MessageToEngine){
        return new Promise<MessageFromOrderbook>((resolve)=>{
            const id=this.getRandomClientId()
            this.client.subscribe(id,(message)=>{
                this.client.unsubscribe(id)
                resolve(JSON.parse(message))
            })
            this.publisher.lPush('messages',JSON.stringify({clientId : id , message}))
        })
    }
    public getRandomClientId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
}