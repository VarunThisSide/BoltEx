import fs from 'node:fs'
import { Orderbook } from "./Orderbook.js";

export const BASE_CURRENCY = "INR";
interface UserBalance {
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