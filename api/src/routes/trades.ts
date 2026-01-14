import { Router } from "express";

export const tradesRouter=Router()

tradesRouter.get('/',(req,res)=>{
    const {market : string}=req.query
    //here i need to send a db query to get trades for the corresponding market
    res.json({})
})