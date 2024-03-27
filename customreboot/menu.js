import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';


import { Extension, gettext as __ } from "resource:///org/gnome/shell/extensions/extension.js";
import { getDefault } from "resource:///org/gnome/shell/misc/systemActions.js";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { PACKAGE_VERSION } from "resource:///org/gnome/shell/misc/config.js";

// Import Utils class

//import
import { SetDebug, LogWarning, Log } from './utils.js';
import { BootLoaders, Bootloader } from "./bootloader.js";

export const RebootSubMenu = GObject.registerClass(
class RebootSubMenu extends PopupMenu.PopupSubMenuMenuItem {

    _init() {
        super._init(__('Restart to…'));

        // Add boot options to menu
        try {
            this.createBootMenu();
        }
        catch (e) {
            LogWarning(e);
        }
    }

    async createBootMenu() {
        // Get boot options
        const type = await Bootloader.GetUseableType();
        console.log(`Using ${type}`)

        const loader = await Bootloader.GetUseable(type);

        this.section = new PopupMenu.PopupMenuSection();

        this.menu.open = (animate) => {
            const heightLimit = 250
            if (this.menu.isOpen)
                return;

            if (this.menu.isEmpty())
                return;

            this.menu.isOpen = true;
            this.menu.emit('open-state-changed')

            this.menu.actor.show()

            let targetAngle = this.menu.actor.text_direction === Clutter.TextDirection.RTL ? -90 : 90;
            let [, naturalHeight] = this.section.actor.get_preferred_height(-1)
            if (naturalHeight > heightLimit) {
                animate = false
                naturalHeight = heightLimit;
                this.menu.actor.vscrollbar_policy = St.PolicyType.AUTOMATIC;
                this.menu.actor.add_style_pseudo_class('scrolled')
            } else {
                this.menu.actor.vscrollbar_policy = St.PolicyType.NEVER;
                this.menu.actor.remove_style_pseudo_class('scrolled')
            }
            const duration = animate ? 250 : 0;
            this.menu.actor.height = 0
            this.menu.actor.ease({
                height: naturalHeight,
                duration,
                mode:Clutter.AnimationMode.EASE_OUT_EXPO,
                onComplete: () => this.menu.actor.set_height(naturalHeight),
            });
            this.menu._arrow.ease({
                rotation_angle_z: targetAngle,
                duration,
                mode: Clutter.AnimationMode.EASE_OUT_EXPO,
            });
        }

        this.menu.addMenuItem(this.section)

        if (loader === undefined) {
            // Set Menu Header
            this.section.setHeader('system-reboot-symbolic', 'Error', 'The selected boot loader cannot be found...');

            // Add reload option, to refresh extension menu without reloading GNOME or the extension
            this.section.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.section.addAction('Reload', () => {
                this.section.removeAll();
                this.createBootMenu();
            });

            // Add button to open settings
            this.section.addAction('Settings', () => {
                Extension.lookupByUUID('hibernate-status@dromi').openPreferences();
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

                this.section.addMenuItem(this._itemsSection);
            }

            // Add reload option, to refresh extension menu without reloading GNOME or the extension
            this.section.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.section.addAction('Reload', () => {
                this.section.removeAll();
                this.createBootMenu();
            });

            // Add button to open settings
            this.section.addAction('Settings', () => {
                Extension.lookupByUUID('hibernate-status@dromi').openPreferences();
            });

            loader.CanQuickReboot().then(async result => {
                if (!result) return;
                if (!await loader.QuickRebootEnabled()) {
                    this.section.addAction('Enable Quick Reboot', async () => {
                        await loader.EnableQuickReboot(Extension.lookupByUUID('hibernate-status@dromi'));
                        this.section.removeAll();
                        this.createBootMenu();
                    });
                }
                else {
                    this.section.addAction('Disable Quick Reboot', async () => {
                        await loader.DisableQuickReboot();
                        this.section.removeAll();
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
                this.section.addMenuItem(new PopupSeparatorMenuItem());
                this.section.addAction('Fix grub.cfg Perms', async () => {
                    await loader.SetReadable();
                    this.section.removeAll();
                    this.createBootMenu(extension);
                });
            }
        })
    }
});
