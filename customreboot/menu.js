import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';


import { Extension, gettext as __ } from "resource:///org/gnome/shell/extensions/extension.js";
import { getDefault } from "resource:///org/gnome/shell/misc/systemActions.js";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import St from 'gi://St';
import { PACKAGE_VERSION } from "resource:///org/gnome/shell/misc/config.js";

// Import Utils class

//import
import { SetDebug, LogWarning, Log } from './utils.js';
import { BootLoaders, Bootloader } from "./bootloader.js";

export const RebootSubMenu = GObject.registerClass(
class RebootSubMenu extends PopupMenu.PopupSubMenuMenuItem {

    _init(extension) {
        super._init(__('Restart to…'));

        // Add boot options to menu
        try {
            this.createBootMenu(extension);
        }
        catch (e) {
            LogWarning(e);
        }
    }

    async createBootMenu(extension) {
        // Get boot options
        const type = await Bootloader.GetUseableType();
        console.log(`Using ${type}`)

        const loader = await Bootloader.GetUseable(type);

        if (loader === undefined) {
            // Set Menu Header
            this.menu.setHeader('system-reboot-symbolic', 'Error', 'The selected boot loader cannot be found...');

            // Add reload option, to refresh extension menu without reloading GNOME or the extension
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addAction('Reload', () => {
                this.menu.removeAll();
                this.createBootMenu();
            });

            // Add button to open settings
            this.menu.addAction('Settings', () => {
                extension.openPreferences();
            });

            return;
        }

        loader.GetBootOptions().then(([bootOps, defaultOpt]) => {
            if (bootOps !== undefined) {
                this._itemsSection = new PopupMenu.PopupMenuSection();

                for (let [title, id] of bootOps) {
                    Log(`${title} - ${id}`);
                    this._itemsSection.addAction(String(title), () => {
                        // Set boot option
                        loader.SetBootOption(String(id)).then(result => {
                            if (result) {
                                // On success trigger restart dialog
                                new getDefault().activateRestart();
                            }
                        });
                    }, (title === defaultOpt || id === defaultOpt)? "pan-end-symbolic" : undefined);
                }

                this.menu.addMenuItem(this._itemsSection);
            }

            // Add reload option, to refresh extension menu without reloading GNOME or the extension
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addAction('Reload', () => {
                this.menu.removeAll();
                this.createBootMenu();
            });

            // Add button to open settings
            this.menu.addAction('Settings', () => {
                extension.openPreferences();
            });

            loader.CanQuickReboot().then(async result => {
                if (!result) return;
                if (!await loader.QuickRebootEnabled()) {
                    this.menu.addAction('Enable Quick Reboot', async () => {
                        await loader.EnableQuickReboot(extension);
                        this.menu.removeAll();
                        this.createBootMenu();
                    });
                }
                else {
                    this.menu.addAction('Disable Quick Reboot', async () => {
                        await loader.DisableQuickReboot();
                        this.menu.removeAll();
                        this.createBootMenu();
                    });
                }
            });

        }).catch((error) => {
            LogWarning(error);
            // Only do this if the current bootloader is grub
            if (type === BootLoaders.GRUB)
            {
                // Only add this if all fails, giving user option to make the config readable
                this.menu.addMenuItem(new PopupSeparatorMenuItem());
                this.menu.addAction('Fix grub.cfg Perms', async () => {
                    await loader.SetReadable();
                    this.menu.removeAll();
                    this.createBootMenu(extension);
                });
            }
        })
    }
});
