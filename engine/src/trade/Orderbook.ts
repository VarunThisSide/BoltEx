import { BASE_CURRENCY } from "./Engine.js";

export interface Order {
    price: number;
    quantity: number;
    orderId: string;
    filled: number;
    side: "buy" | "sell";
    userId: string;
}

export interface Fill {
    price: string;
    qty: number;
    tradeId: number;
    otherUserId: string;
    markerOrderId: string;
}

export class Orderbook{
    bids : Order[]
    asks : Order[]
    baseAsset : string
    quoteAsset : string = BASE_CURRENCY
    lastTradeId : number
    currentPrice : number
    constructor(bids:Order[],asks:Order[],baseAsset:string,lastTradeId:number,currentPrice : number){
        this.asks=asks
        this.bids=bids
        this.baseAsset=baseAsset
        this.lastTradeId=lastTradeId || 0
        this.currentPrice=currentPrice || 0
    }
    ticker(){
        return `${this.quoteAsset}_${this.baseAsset}`
    }
    getSnapshot(){
        return{
            bids : this.bids,
            asks : this.asks,
            baseAsset : this.baseAsset,
            lastTradeId : this.lastTradeId,
            currentPrice : this.currentPrice
        }
    }

    addOrder(order : Order) : {executedQty : number,fills : Fill[]}{
        if(order.side==='buy'){
            const {executedQty , fills} = this.matchBid(order)  //matching current bid from asks list
            order.filled=executedQty
            if(order.filled == order.quantity){
                return({
                    executedQty,
                    fills
                })
            }
            this.bids.push(order)
            return({
                executedQty,
                fills
            })
        }else{
            const {executedQty,fills}=this.matchAsk(order)     //matching current ask from bids list
            order.filled=executedQty
            if(order.filled === order.quantity){
                return({
                    executedQty,
                    fills
                })
            }
            this.asks.push(order)
            return({
                executedQty,
                fills
            })
        }
    }

    matchBid(order : Order) : {executedQty : number,fills : Fill[]}{
        const fills : Fill[]=[]
        let executedQty=0
        this.asks.sort

        for(let i=0;i<this.asks.length;i++){
            if(executedQty===order.quantity){
                break;
            }
            if(this.asks[i]?.price <= order.price){
                const filledQty=Math.min(this.asks[i]?.quantity - this.asks[i]?.filled, order.quantity-executedQty)
                executedQty+=filledQty
                this.asks[i]?.filled+=filledQty
                fills.push({
                    price : this.asks[i]?.price.toString(),
                    qty : filledQty,
                    tradeId : this.lastTradeId++,
                    otherUserId : this.asks[i]?.userId,
                    markerOrderId : this.asks[i]?.orderId
                })
            }
        }
        for(let i=0;i<this.asks.length;i++){
            if(this.asks[i]?.filled === this.asks[i]?.quantity){
                this.asks.splice(i,1)
                i--;
            }
        }
        return({
            fills,
            executedQty
        })
    }

    matchAsk(order : Order): {executedQty : number,fills : Fill[]}{
        let fills : Fill[]=[]
        let executedQty=0
        this.bids.sort((a,b)=>b.price-a.price)

        for(let i=0;i<this.bids.length;i++){
            if(executedQty === order.quantity){
                break
            }
            if(this.bids[i]?.price>=order.price){
                const amountRemaining=Math.min(this.bids[i]?.quantity - this.bids[i]?.filled , order.quantity - executedQty)
                executedQty+=amountRemaining
                this.bids[i]?.filled+=amountRemaining
                fills.push({
                    price : this.bids[i]?.price.toString(),
                    qty : amountRemaining,
                    tradeId : this.lastTradeId++,
                    otherUserId : this.bids[i]?.userId,
                    markerOrderId : this.bids[i]?.orderId
                })
            }
        }
        for(let i=0;i<this.bids.length;i++){
            if(this.bids[i]?.filled === this.bids[i]?.quantity){
                this.bids.splice(i,1)
                i--
            }
        }
        return({
            fills,
            executedQty
        })
    }

    getDepth(){
        let bids : [string,string][] = []
        let asks : [string,string][] = []

        let bidsObj : {[key:string]: number}={}
        let asksObj : {[key:string]: number}={}
        
        for(let i=0;i<this.bids.length;i++){
            const order=this.bids[i]
            if(!bidsObj[order?.price]){
                bidsObj[order?.price]=0
            }
            bidsObj[order?.price]+=(order?.quantity-order?.filled)
        }
        for(const price in bidsObj){
            bids.push([price,bidsObj[price]?.toString()])
        }

        for(let i=0;i<this.asks.length;i++){
            const order=this.asks[i]
            if(!asksObj[order?.price]){
                asksObj[order?.price]=0
            }
            asksObj[order?.price]+=(order?.quantity-order?.filled)
        }
        for(const price in asksObj){
            asks.push([price,asksObj[price]?.toString()])
        }
        return({
            bids,
            asks
        })
    }

    getOpenOrders(userId : string) : Order[]{
        const asks=this.asks.filter(o=>o.userId===userId)
        const bids=this.bids.filter(o=>o.userId===userId)
        return [...asks,...bids]
    }

    cancelBid(order : Order){
        const index=this.bids.findIndex(o=>o.orderId===order.orderId)
        if(index!=-1){
            const price=this.bids[index]?.price
            this.bids.splice(index,1)
            return price
        }
    }

    cancelAsk(order : Order){
        const index=this.asks.findIndex(o=>o.orderId===order.orderId)
        if(index!=-1){
            const price=this.asks[index]?.price
            this.asks.splice(index,1)
            return price
        }
    }
}