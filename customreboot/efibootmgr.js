import Gio from "gi://Gio";
import { ExecCommand, Log, LogWarning } from './utils.js';

/**
 * Represents efibootmgr
 */
export class EFIBootManager {
  /**
   * Get's all available boot options
   * @returns {[Map, string]} Map(title, id), defaultOption
   */
  static async GetBootOptions() {
    const [status, stdout, stderr] = await ExecCommand(['efibootmgr'],);
    const lines = stdout.split("\n");

    let boot_first = "0000";

    const boot_options = new Map();

    for (let l = 0; l < lines.length; l++) {
        const line = lines[l];
        if (line.startsWith("BootOrder:")) {
            boot_first = line.split(" ")[1].split(",")[0];
            continue;
        }

        const regex = /(Boot[0-9]{4})/;
        const vLine = regex.exec(line)
        if (vLine && vLine.length) {
            const option = line.replace("Boot", "").split("*");
            const title = option[1];
            if (title.includes("HD") || title.includes("RC")) {
                const trimed_title = title.replace(/(?<=[\S\s]*)(HD|RC)([\s\S()]*|$)/, "").trim();
                boot_options.set(trimed_title, option[0].trim());
            }
            else {
                boot_options.set(option[1].trim(), option[0].trim());
            }
        }
    }

    return [boot_options, boot_first];
  }

  /**
   * Set's the next boot option
   * @param {string} id 
   * @returns True if the boot option was set, otherwise false
   */
  static async SetBootOption(id) {
    if (!this.IsUseable()) return false;
    const [status, stdout, stderr] = await ExecCommand(['/usr/bin/pkexec', 'efibootmgr', '-n', id],);
    if (status === 0) {
        Log(`Set boot option to ${id}`);
        return true;
    }
    LogWarning("Unable to set boot option using efibootmgr");
    return false;
  }

  /**
   * Can we use this bootloader?
   * @returns True if useable otherwise false
   */
  static async IsUseable() {
    return await this.GetBinary() !== "";
  }

  /**
   * Get's efibootmgr binary path
   * @returns A string containing the location of the binary, if none is found returns a blank string
   */
  static async GetBinary() {
    let paths = ["/usr/bin/efibootmgr"];

    let file;

    for (let i = 0; i < paths.length; i++) {
        file = Gio.file_new_for_path(paths[i]);
        if (file.query_exists(null)) {
            return paths[i];
        }
    }

    return ""; 
  }

  /**
   * This boot loader cannot be quick rebooted
   */
  static async CanQuickReboot() {
    return false;
  }

  /**
   * This boot loader cannot be quick rebooted
   */ 
  static async QuickRebootEnabled() {
    return false;
  }
}