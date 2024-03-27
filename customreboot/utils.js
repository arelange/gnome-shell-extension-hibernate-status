/* utils.js
 *
 * Copyright (C) 2020
 *      Daniel Shchur (DocQuantum) <shchurgood@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
*/

import GLib from 'gi://GLib';
import Gio from "gi://Gio";


var DEBUG = false;

/**
 * @param {String[]} argv 
 * @param {String} input 
 * @param {Gio.Cancellable} cancellable
 * @returns {Promise} Function execution
 * => @returns {[int, String, String]} [StatusCode, STDOUT, STDERR]
 * 
 * Executes a command asynchronously.
 */
export async function ExecCommand(argv, input = null, cancellable = null) {
    let flags = Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE;

    if (input !== null)
        flags |= Gio.SubprocessFlags.STDIN_PIPE;

    let proc = new Gio.Subprocess({
        argv: argv,
        flags: flags
    });
    proc.init(cancellable);
    return new Promise((resolve,reject) => {
        proc.communicate_utf8_async(input, cancellable, (proc, res) => {
            try {
                resolve([(function() {
                    if(!proc.get_if_exited())
                        throw new Error("Subprocess failed to exit in time!");
                    return proc.get_exit_status()
                })()].concat(proc.communicate_utf8_finish(res).slice(1)));
            } catch (e) {
                reject(e);
            }
        });
    });
}

/**
 * @param {bool} value
 * 
 * Set's whether to debug or to not.
 */
export function SetDebug(value){
    DEBUG = value;
}

/**
 * @param {string} msg 
 * 
 * Logs general messages if debug is set to true.
 */
export function Log(msg) {
    if(DEBUG)
        console.log(`CustomReboot NOTE: ${msg}`);
}

/**
 * @param {string} msg 
 * 
 * Logs warning messages if debug is set to true.
 */
export function LogWarning(msg) {
    if(DEBUG)
        console.warn(`CustomReboot WARN: ${msg}`);
}