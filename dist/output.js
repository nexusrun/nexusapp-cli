"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusBadge = statusBadge;
exports.printTable = printTable;
exports.printJson = printJson;
exports.spinner = spinner;
exports.timeAgo = timeAgo;
exports.success = success;
exports.errorMsg = errorMsg;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const ora_1 = __importDefault(require("ora"));
const STATUS_COLORS = {
    RUNNING: chalk_1.default.green,
    BUILDING: chalk_1.default.yellow,
    DEPLOYING: chalk_1.default.yellow,
    FAILED: chalk_1.default.red,
    STOPPED: chalk_1.default.gray,
    PENDING: chalk_1.default.blue,
    QUEUED: chalk_1.default.blue,
    TERMINATED: chalk_1.default.gray,
};
function statusBadge(status) {
    const colorFn = STATUS_COLORS[status?.toUpperCase()] || chalk_1.default.white;
    return colorFn(status || 'UNKNOWN');
}
function printTable(headers, rows) {
    const table = new cli_table3_1.default({
        head: headers.map((h) => chalk_1.default.bold(h)),
        style: { head: [], border: [] },
        chars: {
            top: '', 'top-mid': '', 'top-left': '', 'top-right': '',
            bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
            left: '', 'left-mid': '', mid: '', 'mid-mid': '',
            right: '', 'right-mid': '', middle: '  ',
        },
    });
    for (const row of rows) {
        table.push(row.map((cell) => cell ?? chalk_1.default.gray('—')));
    }
    console.log(table.toString());
}
function printJson(obj) {
    console.log(JSON.stringify(obj, null, 2));
}
function spinner(text) {
    return (0, ora_1.default)(text).start();
}
function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60)
        return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60)
        return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)
        return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}
function success(msg) {
    console.log(chalk_1.default.green('✓') + ' ' + msg);
}
function errorMsg(msg) {
    console.error(chalk_1.default.red('✗') + ' ' + msg);
}
//# sourceMappingURL=output.js.map