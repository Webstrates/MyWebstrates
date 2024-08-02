# MyWebstrates

This is the code repo for MyWebstrates which will be presented at [UIST 2024](https://uist.acm.org/2024/) in Pittsburgh Oct. 13-16 2024. Documentation will be released at the latest for the conference. 

# Paper
[Research paper (pdf)](https://pure.au.dk/admin/files/385885602/MyWebstrates-UIST2024.pdf)

# Public hosting
There's a public hosting of MyWebstrates at [my.webstrates.net](https://my.webstrates.net).

# To build:
```bash
yarn install
yarn build # or yarn watch for development
```

# To run:
Start a webserver in the `dist` directory. For example:
```bash
cd dist
python3 -m http.server 3333
```
Then open your browser to `http://localhost:3333`

You can create a new strate with `http://localhost:3333/new`
