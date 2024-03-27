import Gio from "gi://Gio";
import { ExecCommand, Log, LogWarning } from './utils.js';

/**
 * Represents grub
 */
export class Grub {
  /**
   * Get's all available boot options
   * @returns {[Map, string]} Map(title, id), defaultOption
   */
  static async GetBootOptions() {
    try {
      let cfgpath = await this.GetConfig();
      if (cfgpath == "") {
          throw new String("Failed to find grub config");
      }

      let bootOptions = new Map();

      let defualtEn = "";

      let file = Gio.file_new_for_path(cfgpath);
      let [suc, content] = file.load_contents(null);
      if (!suc) {
          throw new String("Failed to load grub config");
      }

      let lines;
      if (content instanceof Uint8Array) {
          lines = new TextDecoder().decode(content);
      }
      else {
          lines = content.toString();
      }

      let entryRx = /^menuentry ['"]([^'"]+)/;
      let defaultRx = /(?<=set default=\")([A-Za-z- ()/0-9]*)(?=\")/
      lines.split('\n').forEach(l => {
          let res = entryRx.exec(l);
          if (res && res.length) {
              bootOptions.set(res[1], res[1]);
          }
          let def = defaultRx.exec(l);
          if (def && def.length) {
              defualtEn = def[0];
          }
      });

      bootOptions.forEach((v, k) => {
          Log(`${k} = ${v}`);
      });

      if (defualtEn == "") defualtEn = bootOptions.keys().next().value;

      return [bootOptions, defualtEn];
          
    } catch (e) {
      LogWarning(e);
      return undefined;
    }
  }

  /**
   * Set's the next boot option
   * @param {string} id 
   * @returns True if the boot option was set, otherwise false
   */
  static async SetBootOption(id) {
    try {
      let [status, stdout, stderr] = await ExecCommand(
          ['/usr/bin/pkexec', '/usr/sbin/grub-reboot', id],
      );
      Log(`Set boot option to ${id}: ${status}\n${stdout}\n${stderr}`);
      return true;
    } catch (e) {
      LogWarning(e);
      return false;
    }
  }

  /**
   * Can we use this bootloader?
   * @returns True if useable otherwise false
   */
  static async IsUseable() {
    return await this.GetConfig() !== "";
  }

  /**
   * Get's grub config file
   * @returns A string containing the location of the config file, if none is found returns a blank string
   */
  static async GetConfig() {
    let paths = ["/boot/grub/grub.cfg", "/boot/grub2/grub.cfg"];

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
   * Copies a custom grub script to allow the extension to quickly reboot into another OS
   * If anyone reads this: Idk how to combine these into one pkexec call, if you do please leave a commit fixing it
   */
  static async EnableQuickReboot(ext) {
    try {
      let [status, stdout, stderr] = await ExecCommand([
          'pkexec',
          'sh',
          '-c',
          `/usr/bin/cp ${ext.lookupByUUID('customreboot@nova1545').path()}/42_custom_reboot /etc/grub.d/42_custom_reboot && /usr/bin/chmod 755 /etc/grub.d/42_custom_reboot && /usr/sbin/update-grub`
        ]);

      if (status !== 0) {
          return false;
      }

      return true;
    }
    catch (e) {
        LogWarning(e);
        return false;
    }
  }
  

  /**
   * Removes the script used to allow the extension to quickly reboot into another OS without waiting for grub's timeout
   * If anyone reads this: Idk how to combine these into one pkexec call, if you do please leave a commit fixing it
   */
  static async DisableQuickReboot() {
    try {

      let [status, stdout, stderr] = await ExecCommand([
          'pkexec',
          'sh',
          '-c',
          '/usr/bin/rm /etc/grub.d/42_custom_reboot && /usr/sbin/update-grub'
        ]);

      if (status !== 0) {
          return false;
      }

      return true;
    }
    catch (e) {
        LogWarning(e);
        return false;
    }
  }


  /**
   * This boot loader can be quick rebooted
   */
  static async CanQuickReboot() {
    return true;
  }

  /**
   * Checks if /etc/grub.d/42_custom_reboot exists
   */ 
  static async QuickRebootEnabled() {
    try {
      let [status, stdout, stderr] = await ExecCommand(['/usr/bin/cat', '/etc/grub.d/42_custom_reboot'],);
      if (status !== 0) {
          LogWarning(`/etc/grub.d/42_custom_reboot not found`);
          return false;
      }
      Log(`/etc/grub.d/42_custom_reboot found`);

      return true;
    }
    catch (e) {
        LogWarning(e);
        return false;
    }
  }

  static async SetReadable() {
    try {
      const config = GetConfig();
      let [status, stdout, stderr] = await ExecCommand(['/usr/bin/pkexec', '/usr/bin/chmod', '644', config],);
      if (status !== 0) {
          Log(`Failed to make ${config} readable`);
          return false;
      }
      Log(`Made ${config} readable`);
      return true;
    }
    catch (e) {
        Log(e);
        return false;
    }
  }
}