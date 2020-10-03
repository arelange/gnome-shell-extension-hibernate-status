# gnome-shell-extension-hibernate-status

Gnome Shell extension that adds a hibernate/hybrid suspend button in Status menu.

Originally developed by [@arelange](https://github.com/arelange); now maintained by [@p91paul](https://github.com/p91paul).

Supports GNOME 3.36.

## FAQ

### Hibernation does not work

Try launching from your terminal

    systemctl hibernate

If it doesn't work, it means hibernation is disabled on your system. Please see:

https://askubuntu.com/questions/1034185/ubuntu-18-04-cant-resume-after-hibernate/1064114#1064114

or

https://help.ubuntu.com/16.04/ubuntu-help/power-hibernate.html

### Hibernation button does not show up, but systemctl hibernate works

If you are running Ubuntu, try putting

    [Enable hibernate in upower]
    Identity=unix-user:*
    Action=org.freedesktop.upower.hibernate
    ResultActive=yes

    [Enable hibernate in logind]
    Identity=unix-user:*
    Action=org.freedesktop.login1.hibernate;org.freedesktop.login1.handle-hibernate-key;org.freedesktop.login1;org.freedesktop.login1.hibernate-multiple-sessions;org.freedesktop.login1.hibernate-ignore-inhibit
    ResultActive=yes

into /etc/polkit-1/localauthority/10-vendor.d/com.ubuntu.desktop.pkla

Otherwise check for similar settings for your distribution. Credit: https://github.com/arelange/gnome-shell-extension-hibernate-status/issues/41#issuecomment-565883599
