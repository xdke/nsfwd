'use strict'

import fs from 'fs'
import got from 'got'
import nsfwjs from 'nsfwjs'
import Express from 'express'
import { node as TFNode } from '@tensorflow/tfjs-node'

const entryPoint = async () => {
    const acceptedMethod = ['GET', 'POST']
    const errorMessage = [
        'method not allowed.',
        'required query parameter "url" is missing.',
        'invalid api key.'
    ]

    // initialize nsfwjs
    const nsfwModel = await nsfwjs.load()
    let resultCounter = 0

    const validateAPIKey = (key) => {
        if ( !process.env.NSFWD_APIKEY ) return true
        return key === process.env.NSFWD_APIKEY
    }

    const response = (res, code, data = null) => {
        res.status(code).json({
            status: code === 200, data
        })
    }

    const remoteImage = async (url) => {
        let TFImage

        try {
            const raw = await got(url).buffer()
            TFImage = TFNode.decodeImage(raw)
            return TFImage
        } catch (e) {
            console.log(e)
            TFImage?.dispose()
            return null
        }
    }

    const classify = async (url) => {
        const TFImage = await remoteImage(url)
        if (!TFImage) return null

        try {
            const resultData = await nsfwModel.classify(TFImage)
            TFImage.dispose()

            console.log(`[nsfwd] new request, total success result: ${++resultCounter}`)
            return resultData
        } catch (e) {
            console.log(e)
            TFImage.dispose()
            return null
        }
    }

    return Express()
        .use(Express.json())
        .all('/check', async (req, res) => {
            if ( !acceptedMethod.includes(req.method.toUpperCase()) )
                return response(res, 405, errorMessage[0])
            
            const { url, key } = req.method.toUpperCase() === 'GET' ? req.query : req.body

            if ( !url ) return response(res, 400, errorMessage[1])
            if ( !validateAPIKey(key) ) return response(res, 401, errorMessage[2])

            const result = await classify(url)
            if ( !result ) return response(res, 500)

            return response(res, 200, result)
        })
        .all('*', (_, res) => res.redirect('https://shiro.eu.org/'))
        .listen(process.env.PORT || 59188, () => console.log('nsfwd is running.'))
}

entryPoint()
