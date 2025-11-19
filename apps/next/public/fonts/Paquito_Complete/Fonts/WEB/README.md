# Installing Webfonts
Follow these simple Steps.

## 1.
Put `paquito/` Folder into a Folder called `fonts/`.

## 2.
Put `paquito.css` into your `css/` Folder.

## 3. (Optional)
You may adapt the `url('path')` in `paquito.css` depends on your Website Filesystem.

## 4.
Import `paquito.css` at the top of you main Stylesheet.

```
@import url('paquito.css');
```

## 5.
You are now ready to use the following Rules in your CSS to specify each Font Style:
```
font-family: Paquito-Regular;
font-family: Paquito-Medium;
font-family: Paquito-Bold;
font-family: Paquito-Variable;

```
## 6. (Optional)
Use `font-variation-settings` rule to controll axes of variable fonts:
wght 300.0

Available axes:
'wght' (range from 300.0 to 700.0

