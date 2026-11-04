# gnome-shell-extension-hibernate-status

Gnome Shell extension that adds a hibernate/hybrid suspend button in Status menu.

Originally developed by [@arelange](https://github.com/arelange) and then [@p91paul](https://github.com/p91paul). Now maintained by [@slaclau](https://github.com/slaclau).

Supports GNOME 45, 46, 47, 48, 49, and 50.

## FAQ

### Hibernation does not work

Try launching from your terminal

    systemctl hibernate

If it doesn't work, it means hibernation is disabled on your system. Please see:

https://askubuntu.com/questions/1034185/ubuntu-18-04-cant-resume-after-hibernate/1064114#1064114

or

https://help.ubuntu.com/16.04/ubuntu-help/power-hibernate.html

### Hibernation button does not show up, but `sudo systemctl hibernate` works

Hibernation is usually disabled for normal users by the distribution's polkit
policy. Ubuntu ships a rule that unconditionally denies the hibernate actions,
so the extension's `CanHibernate()` query returns `no` and the button stays
hidden, even though root can hibernate.

Install the rule shipped with this repository:

    sudo install -m 644 polkit/00-enable-hibernate.rules /etc/polkit-1/rules.d/

It allows local users in the `sudo` group to hibernate. No logout is required:
open the power menu again and the Hibernate entry will appear.

Older Ubuntu releases used a `.pkla` file at
`/etc/polkit-1/localauthority/10-vendor.d/com.ubuntu.desktop.pkla`; polkit 126
and newer no longer read those files, so use the `.rules` file above instead.
Credit: https://github.com/arelange/gnome-shell-extension-hibernate-status/issues/41#issuecomment-565883599
