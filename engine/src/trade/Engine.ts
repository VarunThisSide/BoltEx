import fs from 'node:fs'
import { Orderbook, type Fill, type Order } from "./Orderbook.js";
import { GET_OPEN_ORDERS, type MessageFromApi } from '../types/fromApi.js';
import { RedisManager } from '../RedisManager.js';
import { ORDER_UPDATE, TRADE_ADDED } from '../types/index.js';

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
                    const {executedQty,fills,orderId}=this.createOrder(message.data.market,message.data.price,message.data.quantity,message.data.side,message.data.userId)
                    RedisManager.getInstance().sendToApi(clientId,{
                        type : 'ORDER_PLACED',
                        payload : {
                            orderId,
                            executedQty,
                            fills
                        }
                    })
                }catch(e){
                    console.log(e)
                    RedisManager.getInstance().sendToApi(clientId,{
                        type : 'ORDER_CANCELLED',
                        payload : {
                            orderId : '',
                            executedQty : 0,
                            remainingQty : Number(message.data.quantity) || 0
                        }
                    })
                }
                break;
            case 'CANCEL_ORDER':
                try{
                    const orderId=message.data.orderId
                    const cancelMarket=message.data.market
                    const cancelOrderbook=this.orderbooks.find(o=>o.ticker()===cancelMarket)
                    const baseAsset=cancelMarket.split('_')[0]
                    const quoteAsset=cancelMarket.split('_')[1]
                    if(!cancelOrderbook){
                        throw new Error('No Orderbook found')
                    }
                    const order=cancelOrderbook.asks.find(o=>o.orderId===orderId) || cancelOrderbook.bids.find(o=>o.orderId===orderId)
                    if(!order){
                        throw new Error('No order found')
                    }

                    if(order.side==='buy'){
                        const price=cancelOrderbook.cancelBid(order)
                        const left=order.quantity-order.filled
                        //@ts-ignore
                        this.balances.get(order.userId)[BASE_CURRENCY].locked-=left*order.price
                        //@ts-ignore
                        this.balances.get(order.userId)[BASE_CURRENCY].available+=left*order.price
                        if(price){
                            this.sendUpdatedDepthAt(price.toString(),cancelMarket)
                        }
                    }else{
                        const price=cancelOrderbook.cancelAsk(order)
                        const left=order.quantity-order.filled
                        //@ts-ignore
                        this.balances.get(order.userId)[baseAsset].locked-=left
                        //@ts-ignore
                        this.balances.get(order.userId)[baseAsset].available+=left
                        if(price){
                            this.sendUpdatedDepthAt(price.toString(),cancelMarket)
                        }
                    }
                    RedisManager.getInstance().sendToApi(clientId,{
                        type : 'ORDER_CANCELLED',
                        payload : {
                            orderId : order.orderId,
                            executedQty : 0,
                            remainingQty : 0
                        }
                    })
                }catch(e){
                    console.log(e)
                    console.log('Error while cancelling order')
                }
                break
            case 'GET_OPEN_ORDERS':
                try{
                    const market=message.data.market
                    const openOrderbook=this.orderbooks.find(o=>o.ticker()===market)
                    if(!openOrderbook){
                        throw new Error('No Orderbook found')
                    }
                    const openOrders=openOrderbook.getOpenOrders(message.data.userId)
                    RedisManager.getInstance().sendToApi(clientId,{
                        type : 'OPEN_ORDERS',
                        payload : openOrders
                    })
                }catch(e){
                    console.log(e)
                }
                break
            case 'ON_RAMP':
                try{
                    const {amount,userId,txnId}=message.data
                    this.onRamp(userId,Number(amount))
                }catch(e){
                    console.log(e)
                }
                break
            case 'GET_DEPTH':
                try{
                    const market=message.data.market
                    const orderbook=this.orderbooks.find(o=>o.ticker()===market)
                    if(!orderbook){
                        throw new Error('No Orderbook found')
                    }
                    RedisManager.getInstance().sendToApi(clientId,{
                        type : 'DEPTH',
                        payload : orderbook.getDepth()
                    })
                }catch(e){
                    console.log(e)
                    RedisManager.getInstance().sendToApi(clientId,{
                        type : 'DEPTH',
                        payload : {
                            bids : [],
                            asks : []
                        }
                    })
                }
                break
        }
    }

    createOrder(market:string,price:string,quantity:string,side:'buy'|'sell',userId:string){
        const orderbook=this.orderbooks.find(o=>o.ticker()===market)
        const baseAsset=market.split('_')[0]
        const quoteAsset=market.split('_')[1]
        if(!orderbook){
            throw new Error('No orderbook found')
        }
        //@ts-ignore
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
        //@ts-ignore
        this.updateBalance(userId,baseAsset,quoteAsset,side,fills,executedQty)

        this.createDbTrades(fills, market, userId);
        this.updateDbOrders(order, executedQty, fills, market);
        this.publishWsDepthUpdates(fills, price, side, market);
        this.publishWsTrades(fills, userId, market);
        return { executedQty, fills, orderId: order.orderId };
    }

    updateBalance(userId:string,baseAsset:string,quoteAsset:string,side:'buy'|'sell',fills:Fill[],executedQty:number){
        if(side==='buy'){
            fills.map((fill)=>{
                //@ts-ignore
                this.balances.get(userId)[baseAsset].available+=fill.qty
                //@ts-ignore
                this.balances.get(userId)[quoteAsset].locked-=(fill.qty*Number(fill.price))
                //@ts-ignore
                this.balances.get(fill.otherUserId)[baseAsset].locked-=fill.qty
                //@ts-ignore
                this.balances.get(fill.otherUserId)[quoteAsset].available+=fill.qty*Number(fill.price)
            })
        }else{
            fills.map((fill)=>{
                //@ts-ignore
                this.balances.get(userId)[baseAsset].locked-=fill.qty
                //@ts-ignore
                this.balances.get(userId)[quoteAsset].available+=fill.qty*Number(fill.price)
                //@ts-ignore
                this.balances.get(fill.otherUserId)[baseAsset].available+=fill.qty
                //@ts-ignore
                this.balances.get(fill.otherUserId)[quoteAsset].locked-=fill.qty*Number(fill.price)
            })
        }
    }

    checkAndLockFunds(baseAsset:string, quoteAsset:string, side:'buy'|'sell', userId:string, price:string, quantity:string){
        if(side==='buy'){
            if((this.balances.get(userId)?.[quoteAsset]?.available || 0) < Number(quantity)*Number(price)){
                throw new Error('Insufficient Balance')
            }
            //@ts-ignore
            this.balances.get(userId)[quoteAsset].locked+=Number(quantity)*Number(price)
            //@ts-ignore
            this.balances.get(userId)[quoteAsset].available-=Number(quantity)*Number(price)
        }else{
            if((this.balances.get(userId)?.[baseAsset]?.available || 0) < Number(quantity)){
                throw new Error('Insufficient Funds')
            }
            //@ts-ignore
            this.balances.get(userId)[baseAsset].locked+=Number(quantity)
            //@ts-ignore
            this.balances.get(userId)[baseAsset].available-=Number(quantity)
        }
    }

    onRamp(userId : string , amount : number){
        const userBalance=this.balances.get(userId)
        if(!userBalance){
            this.balances.set(userId,{
                [BASE_CURRENCY] : {
                    available : amount,
                    locked : 0
                }
            })
        }else{
            //@ts-ignore
            userBalance[BASE_CURRENCY].available+=amount
        }
    }

    createDbTrades(fills:Fill[],market:string,userId:string){
        fills.forEach(fill => {
            RedisManager.getInstance().pushMessage({
                type: TRADE_ADDED,
                data: {
                    market: market,
                    id: fill.tradeId.toString(),
                    isBuyerMaker: fill.otherUserId === userId, // TODO: Is this right?
                    price: fill.price,
                    quantity: fill.qty.toString(),
                    quoteQuantity: (fill.qty * Number(fill.price)).toString(),
                    timestamp: Date.now()
                }
            });
        });
    }

    updateDbOrders(order: Order, executedQty: number, fills: Fill[], market: string) {
        RedisManager.getInstance().pushMessage({
            type: ORDER_UPDATE,
            data: {
                orderId: order.orderId,
                executedQty: executedQty,
                market: market,
                price: order.price.toString(),
                quantity: order.quantity.toString(),
                side: order.side,
            }
        });

        fills.forEach(fill => {
            RedisManager.getInstance().pushMessage({
                type: ORDER_UPDATE,
                data: {
                    orderId: fill.markerOrderId,
                    executedQty: fill.qty
                }
            });
        });
    }

    publishWsDepthUpdates(fills: Fill[], price: string, side: "buy" | "sell", market: string) {
        const orderbook = this.orderbooks.find(o => o.ticker() === market);
        if (!orderbook) {
            return;
        }
        const depth = orderbook.getDepth();
        if (side === "buy") {
            const updatedAsks = depth?.asks.filter(x => fills.map(f => f.price).includes(x[0].toString()));
            const updatedBid = depth?.bids.find(x => x[0] === price);
            console.log("publish ws depth updates")
            RedisManager.getInstance().publishMessage(`depth@${market}`, {
                stream: `depth@${market}`,
                data: {
                    a: updatedAsks,
                    b: updatedBid ? [updatedBid] : [],
                    e: "depth"
                }
            });
        }
        if (side === "sell") {
           const updatedBids = depth?.bids.filter(x => fills.map(f => f.price).includes(x[0].toString()));
           const updatedAsk = depth?.asks.find(x => x[0] === price);
           console.log("publish ws depth updates")
           RedisManager.getInstance().publishMessage(`depth@${market}`, {
               stream: `depth@${market}`,
               data: {
                   a: updatedAsk ? [updatedAsk] : [],
                   b: updatedBids,
                   e: "depth"
               }
           });
        }
    }

    publishWsTrades(fills: Fill[], userId: string, market: string) {
        fills.forEach(fill => {
            RedisManager.getInstance().publishMessage(`trade@${market}`, {
                stream: `trade@${market}`,
                data: {
                    e: "trade",
                    t: fill.tradeId,
                    m: fill.otherUserId === userId, // TODO: Is this right?
                    p: fill.price,
                    q: fill.qty.toString(),
                    s: market,
                }
            });
        });
    }

    sendUpdatedDepthAt(price: string, market: string) {
        const orderbook = this.orderbooks.find(o => o.ticker() === market);
        if (!orderbook) {
            return;
        }
        const depth = orderbook.getDepth();
        const updatedBids = depth?.bids.filter(x => x[0] === price);
        const updatedAsks = depth?.asks.filter(x => x[0] === price);
        
        RedisManager.getInstance().publishMessage(`depth@${market}`, {
            stream: `depth@${market}`,
            data: {
                a: updatedAsks.length ? updatedAsks : [[price, "0"]],
                b: updatedBids.length ? updatedBids : [[price, "0"]],
                e: "depth"
            }
        });
    }

    addOrderbook(orderbook : Orderbook){
        this.orderbooks.push(orderbook)
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