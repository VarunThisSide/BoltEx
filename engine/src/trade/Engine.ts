import fs from 'node:fs'
import { Orderbook, type Fill, type Order } from "./Orderbook.js";
import type { MessageFromApi } from '../types/fromApi.js';

export const BASE_CURRENCY = "INR";
interface UserBalance {     // INR : {available:  , locked : }
    [key: string]: {
        available: number;
        locked: number;
    }
}

export class Engine{
    private orderbooks : Orderbook[]=[]
    private balances : Map<string,UserBalance> = new Map()
    constructor(){
        let snapshot=null
        try{
            if(process.env.WITH_SNAPSHOT){
                snapshot=fs.readFileSync('./snapshot.json')
            }
        }catch(e){
            console.log('No snapshot found')
        }

        if(snapshot){
            const snapShot=JSON.parse(snapshot.toString())
            this.orderbooks=snapShot.orderbooks.map((o : Orderbook)=>new Orderbook(o.bids,o.asks,o.baseAsset,o.lastTradeId,o.currentPrice))
            this.balances=new Map(snapShot.balances)
        }else{
            this.orderbooks=[new Orderbook([],[],'TATA',0,0)]
            this.setBaseBalances()  //assigning dummy shares to users
        }
        setInterval(() => {
            this.saveSnapshot()
        }, 3000);
    }

    process({message,clientId} : {message : MessageFromApi , clientId : string}){
        switch(message.type){
            case 'CREATE_ORDER':
                try{
                    
                }catch(e){

                }
        }
    }

    createOrder(market:string,price:string,quantity:string,side:'buy'|'sell',userId:string){
        const orderbook=this.orderbooks.find(o=>o.ticker()===market)
        const baseAsset=market.split('_')[0]
        const quoteAsset=market.split('_')[1]
        if(!orderbook){
            throw new Error('No orderbook found')
        }
        this.checkAndLockFunds(baseAsset,quoteAsset,side,userId,price,quantity)
        
        const order : Order = {
            price : Number(price),
            quantity : Number(quantity),
            orderId : Math.random().toString(36).substring(2,15)+Math.random().toString(36).substring(2,15),
            filled : 0,
            side : side,
            userId : userId
        }
        
        const {executedQty,fills}=orderbook.addOrder(order)
        this.updateBalance(userId,baseAsset,quoteAsset,side,fills,executedQty)

        
    }

    updateBalance(userId:string,baseAsset:string,quoteAsset:string,side:'buy'|'sell',fills:Fill[],executedQty:number){
        if(side==='buy'){
            fills.map((fill)=>{
                this.balances.get(userId)?.[baseAsset]?.available+=fill.qty
                this.balances.get(userId)?.[quoteAsset]?.locked-=(fill.qty*Number(fill.price))
                this.balances.get(fill.otherUserId)?.[baseAsset]?.locked-=fill.qty
                this.balances.get(fill.otherUserId)?.[quoteAsset]?.available+=fill.qty*Number(fill.price)
            })
        }else{
            fills.map((fill)=>{
                this.balances.get(userId)?.[baseAsset]?.locked-=fill.qty
                this.balances.get(userId)?.[quoteAsset]?.available+=fill.qty*Number(fill.price)
                this.balances.get(fill.otherUserId)?.[baseAsset]?.available+=fill.qty
                this.balances.get(fill.otherUserId)?.[quoteAsset]?.locked-=fill.qty*Number(fill.price)
            })
        }
    }

    checkAndLockFunds(baseAsset:string, quoteAsset:string, side:'buy'|'sell', userId:string, price:string, quantity:string){
        if(side==='buy'){
            if((this.balances.get(userId)?.[quoteAsset]?.available || 0) < Number(quantity)*Number(price)){
                throw new Error('Insufficient Balance')
            }
            this.balances.get(userId)?.[quoteAsset]?.locked+=Number(quantity)*Number(price)
            this.balances.get(userId)?.[quoteAsset]?.available-=Number(quantity)*Number(price)
        }else{
            if((this.balances.get(userId)?.[baseAsset]?.available || 0) < Number(quantity)){
                throw new Error('Insufficient Funds')
            }
            this.balances.get(userId)?.[baseAsset]?.locked+=Number(quantity)
            this.balances.get(userId)?.[baseAsset]?.available-=Number(quantity)
        }
    }

    saveSnapshot(){ 
        const snapshot={
            orderbooks : this.orderbooks.map(o=>o.getSnapshot()),
            balances : Array.from(this.balances.entries())
        }
        fs.writeFileSync('./snapshot.json',JSON.stringify(snapshot))
    }

    setBaseBalances() {
        this.balances.set("1", {
            [BASE_CURRENCY]: {
                available: 10000000,
                locked: 0
            },
            "TATA": {
                available: 10000000,
                locked: 0
            }
        });

        this.balances.set("2", {
            [BASE_CURRENCY]: {
                available: 10000000,
                locked: 0
            },
            "TATA": {
                available: 10000000,
                locked: 0
            }
        });

        this.balances.set("5", {
            [BASE_CURRENCY]: {
                available: 10000000,
                locked: 0
            },
            "TATA": {
                available: 10000000,
                locked: 0
            }
        });
    }
}