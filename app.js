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

    console.log("Writing index.html");

    const indextemplatedata = fs.readFileSync('indextemplate.html', {encoding: 'utf8', flag: 'r'});
    const indextemplate = Handlebars.default.compile(indextemplatedata);

    const index = indextemplate({stockdata: stockdata, indexstart : indexstart, indexend: indexend});
    fs.writeFileSync('web/index.html', index);

    fs.writeFileSync('web/stockdata.json', JSON.stringify(stockdata));
})();

