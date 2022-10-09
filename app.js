import * as fs from 'fs';
import {parse} from 'csv-parse/sync';
import {got} from "got";
import * as Handlebars from 'handlebars';

function formatDate(date) {
    let month = '' + (date.getMonth() + 1);
    let day = '' + date.getDate();
    const year = date.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [year, month, day].join('');
}

const today = new Date();
const todayminus4years = new Date();
todayminus4years.setDate(todayminus4years.getDate() - 365 * 4);

const indexstart = formatDate(todayminus4years);
const indexend = formatDate(today);

(async () => {
    const stockdata = {stocks: {}, levels: []};

    const reporttemplatedata = fs.readFileSync('reporttemplate.html', {encoding: 'utf8', flag: 'r'});
    const reporttemplate = Handlebars.default.compile(reporttemplatedata);

    const csvdata = fs.readFileSync('indexlist.csv', {encoding: 'utf8', flag: 'r'})
    const records = parse(csvdata, {delimiter: ',', from_line: 2});
    for (let i = 0; i < records.length; i++) {

        const record = records[i];

        const indexdata = {
            indexid: record[0],
            indexname: record[1],
            indexcurrency: record[2],
            indexvariant: record[3],
            indexstart: indexstart,
            indexend: indexend
        };

        stockdata.stocks[indexdata.indexid] = {
            id: indexdata.indexid,
            name: indexdata.indexname,
            currency: indexdata.indexcurrency,
            indexvariant: indexdata.indexvariant,
        };

        console.log("Downloading indexdata " + indexdata.indexid + " " + indexdata.indexname);
        const url = "https://app2.msci.com/products/service/index/indexmaster/getLevelDataForGraph?currency_symbol=" + indexdata.indexcurrency + "&index_variant=" + indexdata.indexvariant + "&start_date=" + indexdata.indexstart + "&end_date=" + indexdata.indexend + "&data_frequency=DAILY&index_codes=" + indexdata.indexid;
        const json = await got(url).json();

        const indexvalues = json.indexes.INDEX_LEVELS;
        for (let j = 0; j < indexvalues.length; j++) {
            const index = indexvalues[j];
            let foundsomething = false;
            for (let k = 0; k < stockdata.levels.length; k++) {
                const stock = stockdata.levels[k];
                if (stock.calc_date === index.calc_date) {
                    stock["" + indexdata.indexid + ""] = index.level_eod;
                    foundsomething = true;
                }
            }
            if (!foundsomething) {
                const newentry = {};
                newentry["calc_date"] = index.calc_date;
                newentry["" + indexdata.indexid + ""] = index.level_eod;
                stockdata.levels.push(newentry);
            }
        }

        fs.writeFileSync('web/' + indexdata.indexid + '.json', JSON.stringify(json));

        const report = reporttemplate(indexdata);

        fs.writeFileSync('web/' + indexdata.indexid + '.html', report);
    }

    function stockDataFrom(stockid, refdate) {
        const levels = [];
        const refAsInt = parseInt(formatDate(refdate))
        for (let i = stockdata.levels.length -1; i >=0 ; i--) {
            let level = stockdata.levels[i];
            if (level.calc_date >= refAsInt) {
                if (level[stockid]) {
                    levels.push(level);
                }
            }
        }
        levels.sort(function(a, b) {
            if (a.calc_date > b.calc_date) {
                return 1;
            }
            if (a.calc_date < b.calc_date) {
                return -1;
            }
            return 0;
        });
        return levels;
    }

    function performanceInPercent(oldvalue, newvalue) {
        const ratio = newvalue / oldvalue;
        if (ratio >= 1) {
            return ((ratio - 1) * 100).toFixed(2);
        }
        return (-((1 - ratio) * 100)).toFixed(2) ;
    }

    // We have to calculate the returns and rists per stock
    var stockids = Object.keys(stockdata.stocks);
    var calcperiods = [7, 30, 90, 180, 365, 730, 1095];
    stockiter: for (var i = 0; i < stockids.length; i++) {
        const stockid = stockids[i];
        const stock = stockdata.stocks[stockid];

        console.log("Calculating performance metrics for " + stockid + " " + stock.name);

        for (var j = 0; j < calcperiods.length; j++) {
            const period = calcperiods[j];

            console.log("  Today minus " + period + " days");

            const todayminus = new Date();
            todayminus.setDate(today.getDate() - period);

            const levels = stockDataFrom(stockid, todayminus);
            console.log("  -> " + levels.length + " datapoints");

            if (levels.length > 2) {
                const currentlevel = levels[levels.length - 1][stockid];
                const earliestlevel = levels[0][stockid];

                let average = 0;
                let last = currentlevel;
                for (var k = 0; k < levels.length; k++) {
                    const p = performanceInPercent(last, levels[k][stockid]);
                    average = average + parseFloat(p);
                    last = levels[k][stockid];
                }
                average = average / levels.length;
                let volatility = 0;
                last = currentlevel;
                for (var k = 0; k < levels.length; k++) {
                    const p = performanceInPercent(last, levels[k][stockid]);
                    const delta = parseFloat(p) - average;
                    volatility = volatility + (delta * delta);
                    last = levels[k][stockid];
                }
                volatility = volatility * (1 / levels.length);
                volatility = Math.sqrt(volatility);

                const perf = performanceInPercent(earliestlevel, currentlevel);

                stock["stats_" + period + "days"] = {
                    performance: perf,
                    winner: perf >= 0 ? true : false,
                    volatility: volatility.toFixed(2),
                    startdate: levels[0].calc_date,
                    startleveleod: earliestlevel,
                    enddate: levels[levels.length - 1].calc_date,
                    endleveleod: currentlevel,
                };
            } else {
                continue stockiter;
            }
        }
    }

    console.log("Writing index.html");

    const indextemplatedata = fs.readFileSync('indextemplate.html', {encoding: 'utf8', flag: 'r'});
    const indextemplate = Handlebars.default.compile(indextemplatedata);

    const stockssorted = [];
    for (var i = 0; i < stockids.length; i++) {
        const stockid = stockids[i];
        stockssorted.push(stockdata.stocks[stockid]);
    }

    stockssorted.sort(function(a, b) {
        if (parseInt(a.stats_365days.performance) < parseInt(b.stats_365days.performance)) {
            return 1;
        }
        if (parseInt(a.stats_365days.performance) > parseInt(b.stats_365days.performance)) {
            return -1;
        }
        return 0;
    });

    const index = indextemplate({stockdata: stockdata, indexstart : indexstart, indexend: indexend, sorted: stockssorted});
    fs.writeFileSync('web/index.html', index);

    fs.writeFileSync('web/stockdata.json', JSON.stringify(stockdata));
})();

