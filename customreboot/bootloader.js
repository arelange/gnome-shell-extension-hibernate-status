import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { EFIBootManager } from "./efibootmgr.js";
import { SystemdBoot } from './systemdBoot.js';
import { Grub } from './grub.js';

import * as Utils from "./utils.js";
import GLib from 'gi://GLib';
import Gio from "gi://Gio";

export const BootLoaders = {
    EFI: "EFI Boot Manager",
    GRUB: "Grub",
    SYSD: "Systemd Boot",
    UNKNOWN: "Unknown Boot Loader"
}

export class Bootloader {
    /**
     * Gets the first available boot loader type on the current system
     * @returns BootLoaders type. Can be "EFI", "SYSD", "GRUB", or "UNKNOWN"
     */
    static async GetUseableType() {
        const settings = Extension.lookupByUUID('customreboot@nova1545').getSettings('org.gnome.shell.extensions.customreboot');

        if (await EFIBootManager.IsUseable() && settings.get_boolean('use-efibootmgr')) return BootLoaders.EFI;
        if (await Grub.IsUseable() && settings.get_boolean('use-grub')) return BootLoaders.GRUB;
        if (await SystemdBoot.IsUseable() && settings.get_boolean('use-systemd-boot')) return BootLoaders.SYSD;
        return BootLoaders.UNKNOWN;
    }

    /**
     * Gets a instance of the provided boot loader
     * @returns A boot loader if one is found otherwise undefined
     */
    static async GetUseable(type) {
        if (type === BootLoaders.EFI) return EFIBootManager;
        if (type === BootLoaders.SYSD) return SystemdBoot;
        if (type === BootLoaders.GRUB) return Grub;
        return undefined;
    }
}