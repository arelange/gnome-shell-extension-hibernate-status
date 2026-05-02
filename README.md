# gnome-shell-extension-hibernate-status

Gnome Shell extension that adds a hibernate/hybrid suspend button in Status menu.

Originally developed by [@arelange](https://github.com/arelange) and then [@p91paul](https://github.com/p91paul). Now maintained by [@slaclau](https://github.com/slaclau).

Supports GNOME 45, 46, 47, and 48.

## FAQ

### Hibernation does not work

Try launching from your terminal

    systemctl hibernate

If it doesn't work, it means hibernation is disabled on your system. Please see:

https://askubuntu.com/questions/1034185/ubuntu-18-04-cant-resume-after-hibernate/1064114#1064114

or

https://help.ubuntu.com/16.04/ubuntu-help/power-hibernate.html

### Hibernation button does not show up, but systemctl hibernate works

This usually means polkit is denying the hibernate actions even though
systemd allows hibernation. On Ubuntu specifically,
`/usr/share/polkit-1/rules.d/com.ubuntu.desktop.rules` ships an explicit
deny rule that hides the button. The fix is a polkit rule that overrides it.

**Recommended (any modern distro):** create
`/etc/polkit-1/rules.d/10-enable-hibernate.rules` with:

    polkit.addRule(function(action, subject) {
        if (action.id == "org.freedesktop.upower.hibernate" ||
            action.id == "org.freedesktop.login1.hibernate" ||
            action.id == "org.freedesktop.login1.handle-hibernate-key" ||
            action.id == "org.freedesktop.login1.hibernate-multiple-sessions" ||
            action.id == "org.freedesktop.login1.hibernate-ignore-inhibit") {
                return polkit.Result.YES;
        }
    });

`polkitd` reloads rules automatically; the button should appear within a few
seconds (toggle the extension off/on if not).

**Legacy `.pkla` form** (older Ubuntu, or any system with the deprecated
`pklocalauthority` backend — installable on Ubuntu 24.04+ via
`sudo apt install polkitd-pkla`): put the following into
`/etc/polkit-1/localauthority/10-vendor.d/com.ubuntu.desktop.pkla`:

    [Enable hibernate in upower]
    Identity=unix-user:*
    Action=org.freedesktop.upower.hibernate
    ResultActive=yes

    [Enable hibernate in logind]
    Identity=unix-user:*
    Action=org.freedesktop.login1.hibernate;org.freedesktop.login1.handle-hibernate-key;org.freedesktop.login1;org.freedesktop.login1.hibernate-multiple-sessions;org.freedesktop.login1.hibernate-ignore-inhibit
    ResultActive=yes

Otherwise check for similar settings for your distribution. Credit: https://github.com/arelange/gnome-shell-extension-hibernate-status/issues/41#issuecomment-565883599
