import type WebSocket from "ws"
import type { IncomingMessage } from "./types/in.js"
import type { OutgoingMessage } from "./types/out.js"
import { SubscriptionManager } from "./SubscriptionManager.js"

export class User{
    private id : string
    private ws : WebSocket
    private subscriptions : string[] = []
    constructor(id : string , ws : WebSocket){
        this.id=id
        this.ws=ws
    }
    public subscribe(subscription : string){
        this.subscriptions.push(subscription)
    }
    public unsubscribe(subscription : string){
        this.subscriptions=this.subscriptions.filter(s=>s!==subscription)
    }
    private addListeners(){
        this.ws.on('message',(message : string)=>{
            const parsedMessage : IncomingMessage=JSON.parse(message)
            if(parsedMessage.method==="SUBSCRIBE"){
                parsedMessage.params.forEach((s)=>SubscriptionManager.getInstance().subscribe(this.id,s))
            }
            if(parsedMessage.method==="UNSUBSCRIBE"){
                parsedMessage.params.forEach(s=>SubscriptionManager.getInstance().unsubscribe(this.id,s))
            }
        })
    }
    public emit(message : OutgoingMessage){
        this.ws.send(JSON.stringify(message))
    }
}