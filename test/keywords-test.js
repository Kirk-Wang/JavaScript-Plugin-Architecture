// LICENSE : MIT
"use strict";
import {getKeywords}  from "stemming-x-keywords";
import path from "path";
import fs from "fs";
import remark from "remark";
import parents from "unist-util-parents";
import select from "unist-util-select";
import isUnist from "unist-util-is";
import nlcstToString  from "nlcst-to-string";

const rootDir = path.join(__dirname, "..");
const OrganizationText = fs.readFileSync(path.join(rootDir, "ORGANIZATION.md"), "utf-8");
function isNotContain(content, keywords) {
    // 含んでないものだけを返す
    return keywords.filter(keyword => {
        return content.indexOf(keyword) === -1;
    });
}
function findAllAfter(ast, node, type) {
    let results = [];
    let children = ast.children;
    let index = 0, length = children.length;
    let isFound = false;
    while (++index < length) {
        let child = children[index];
        if (isUnist(node, child)) {
            isFound = true;
        } else if (isFound) {
            if (isUnist(type, child)) {
                results.push(child);
            } else {
                break;
            }
        }
    }

    return results;
}

function isAlreadyCheckKeyword(list, keyword) {
    return list.indexOf(keyword) !== -1;
}

// P ASTからキーワードを抽出する
function getKeywordsOfParagraphsAsync(paragraphs) {
    let _keywords = [];
    let promiseList = paragraphs.map(p => {
        let text = nlcstToString(p);
        return getKeywords(text).then(keywords => {
            _keywords = _keywords.concat(keywords);
        });
    });
    return Promise.all(promiseList).then(()=> {
        return _keywords;
    });
}
function checkKeyword(text) {
    let ast = remark.parse(text);
    let headerLinks = select(parents(ast), "heading link[href]");
    let paragraphList = headerLinks.map(link => {
        let filePath = path.resolve(rootDir, link.href);
        let paragraphs = findAllAfter(ast, link.parent.node, "paragraph");
        return getKeywordsOfParagraphsAsync(paragraphs).then(keywords => {
            return {
                filePath: filePath,
                content: fs.readFileSync(filePath, "utf-8"),
                keywords: keywords
            };
        });
    });
    return Promise.all(paragraphList).then(results => {
        let confirmedKeywords = [];
        return results.forEach(({filePath, content, keywords}) => {
            let unusedKeywords = isNotContain(content, keywords);
            let isChecked = isAlreadyCheckKeyword.bind(null, confirmedKeywords);
            if (unusedKeywords.length === 0) {
                // 使用済みのキーワードを登録
                confirmedKeywords = confirmedKeywords.concat(keywords);
                return;
            }
            if (unusedKeywords.every(isChecked)) {
                console.log(unusedKeywords.join(",") + "はチェック済み");
                return;
            }
            throw new Error(`"${unusedKeywords.join(",")}" are not used in ${filePath}`);
        });
    });
}
// キーワードが書くコンテンツに含まれているかをテストする
describe("keywords", function () {
    it("Each chapter contain the keyword", function () {
        return checkKeyword(OrganizationText);
    });
});
