import fs from 'fs';

import _ from 'lodash';
import mongoose from 'mongoose';

import dbConfig from './db_config';
import Log from './models/log';

const DEVICE = 'bcache0';
const basePath = `/sys/block/${ DEVICE }`;
const updateInterval = 60000;

let infoMap = {
    state: 'bcache/state',
    dirtyData: 'bcache/dirty_data',
    writebackPercent: 'bcache/writeback_percent',
    writebackRate: 'bcache/writeback_rate',
    cacheMode: 'bcache/cache_mode',
    cacheAvailablePercent: 'bcache/cache/cache_available_percent',
    cacheSize: 'bcache/cache/cache0/../size',
    backingSize: 'size',
    // priorityStats: 'bcache/cache/cache0/priority_stats',
    // stat: 'stat',
};

let cacheInfoMap = {
    cacheHits: 'cache_hits',
    cacheMisses: 'cache_misses',
    cacheHitRatio: 'cache_hit_ratio',

    cacheBypassHits: 'cache_bypass_hits',
    cacheBypassMisses: 'cache_bypass_misses',

    cacheMissCollisions: 'cache_miss_collisions',

    cacheReadaheads: 'cache_readaheads',
};


function readData(map, root=basePath, unusedPercent) {
    let keys = Object.keys(map);
    let res = {};

    keys.forEach((key) => {
        let data = fs.readFileSync(`${ root }/${ map[key] }`, 'utf8').trim();


        if (key === 'cacheSize') {
            let sizeInt = parseInt(data, 10)
            res[key] = sizeInt;
            res.cacheUnusedSize = (sizeInt * unusedPercent);
            res.cacheUsedSize = (res[key] - res.cacheUnusedSize);
        } else {
            res[key] = data;
        }
    });

    return res;
}

function getUnusedPercent() {
    let priorityStatsPath = `${ basePath }/bcache/cache/cache0/priority_stats`;
    let stats = fs.readFileSync(priorityStatsPath, 'utf8').split('\n');
    let unusedMatch = stats[0].match(/(\d+)\%$/) || [];
    let unused = unusedMatch[1];


    if (unused) {
        unused = Number(unused) / 100;
    } else {
        unused = 0;
    }

    return unused;
}

function generateStats() {
    let unused = getUnusedPercent();
    let info = readData(infoMap, undefined, unused);
    info.unusedPercent = unused;

    let statsTotal = readData(cacheInfoMap, `${ basePath }/bcache/stats_total`);
    let statsDay = readData(cacheInfoMap, `${ basePath }/bcache/stats_day`);
    let statsHour = readData(cacheInfoMap, `${ basePath }/bcache/stats_hour`);
    let stats5Min = readData(cacheInfoMap, `${ basePath }/bcache/stats_five_minute`);

    let bcacheStats = {
        info,
        statsTotal,
        statsDay,
        statsHour,
        stats5Min,
    };

    return bcacheStats;
}


function statsGen() {
    let bcacheStats = generateStats();

    let log = new Log();
    log.data = bcacheStats;
    log.save((err) => {
        if (err) {
            console.log('Error saving log');
            throw err;
        }
    });
}


mongoose.connect(dbConfig.url);

console.log('bcache monitor running...')

global.setInterval(function() {
    statsGen();
}, updateInterval);

statsGen();
