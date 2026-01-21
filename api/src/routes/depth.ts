import { Router } from "express";
import { RedisManager } from "../RedisManager.js";
import { GET_DEPTH } from "../types/index.js";

export const depthRouter=Router()

depthRouter.get('/',async (req,res)=>{
    const response=await RedisManager.getInstance().sendAndAwait({
        type : GET_DEPTH,
        data : {
            market : req.query.market as string
        }
    })
    res.json(response.payload)
})