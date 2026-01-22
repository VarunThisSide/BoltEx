import { createClient, type RedisClientType } from "redis"
import { UserManager } from "./UserManager.js"

export class SubscriptionManager{
    private static instance : SubscriptionManager
    private subscriptions : Map<string,string[]> = new Map()
    private reverseSubscriptions : Map<string,string[]> = new Map()
    private redisClient : RedisClientType
    private constructor(){
        this.redisClient=createClient({
            username : 'default',
            password : process.env.REDIS_PASSWORD || '',
            socket : {
                host: process.env.REDIS_HOST,
                port: 12819
            }
        })
        this.redisClient.connect()
    }
    public static getInstance(){
        if(!this.instance){
            this.instance=new SubscriptionManager()
        }
        return this.instance
    }
    public subscribe(userId:string , subscription:string){
        if(this.subscriptions.get(userId)?.includes(subscription)){
            return
        }
        this.subscriptions.set(userId,(this.subscriptions.get(userId) || []).concat(subscription))
        this.reverseSubscriptions.set(subscription,(this.reverseSubscriptions.get(subscription) || []).concat(userId))
        if(this.reverseSubscriptions.get(subscription)?.length===1){
            this.redisClient.subscribe(subscription,(message : string , channel : string)=>{
                const parsedMessage=JSON.parse(message)
                this.reverseSubscriptions.get(channel)?.forEach((s)=>UserManager.getInstance().getUser(s)?.emit(parsedMessage))
            })
        }
    }
    public unsubscribe(userId:string , subscription : string){
        let subscriptions=this.subscriptions.get(userId)
        if(subscriptions){
            this.subscriptions.set(userId , subscriptions.filter((s)=>s!==subscription))
        }
        let reverseSubscription=this.reverseSubscriptions.get(subscription)
        if(reverseSubscription){
            this.reverseSubscriptions.set(subscription,reverseSubscription.filter(u=>u!==userId))
            if(this.reverseSubscriptions.get(subscription)?.length === 0){
                this.reverseSubscriptions.delete(subscription)
                this.redisClient.unsubscribe(subscription)
            }
        }
    }
    public userLeft(userId:string){
        this.subscriptions.get(userId)?.forEach(s=>this.unsubscribe(userId,s))
        console.log('user left :'+userId)
    }
    public getSubscriptions(userId : string){
        return this.subscriptions.get(userId) || []
    }
}