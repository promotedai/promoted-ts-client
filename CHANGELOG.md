## [10.1.1](https://github.com/promotedai/promoted-ts-client/compare/v10.1.0...v10.1.1) (2023-02-24)


### Bug Fixes

* the promoted-ts-client version string ([#83](https://github.com/promotedai/promoted-ts-client/issues/83)) ([de2f02b](https://github.com/promotedai/promoted-ts-client/commit/de2f02bb4e1a06ed6462da57a15f8ee96db603e4))

# [10.1.0](https://github.com/promotedai/promoted-ts-client/compare/v10.0.0...v10.1.0) (2022-08-21)


### Features

* blocking shadow traffic ([#77](https://github.com/promotedai/promoted-ts-client/issues/77)) ([26cc11e](https://github.com/promotedai/promoted-ts-client/commit/26cc11e10c3214961337fa1d0c085d88af4b0352))

# [10.0.0](https://github.com/promotedai/promoted-ts-client/compare/v9.0.0...v10.0.0) (2022-08-09)


### Bug Fixes

* experiment modulo; default buckets ([#76](https://github.com/promotedai/promoted-ts-client/issues/76)) ([bedb64c](https://github.com/promotedai/promoted-ts-client/commit/bedb64cda6b9d8871e065920c264f516a1ea3bfd))


### BREAKING CHANGES

* This changes the experiment arms that users will be in.

This fixes two issues:
1. The modulo logic is wrong for negative numbers.  Typescript '%' is a remainder function.
2. Change the default user buckets to 1k so experiment arm percents work down to 0.1%.

TESTING=unit tests

# [9.0.0](https://github.com/promotedai/promoted-ts-client/compare/v8.4.0...v9.0.0) (2022-08-09)


### Bug Fixes

* build ([#75](https://github.com/promotedai/promoted-ts-client/issues/75)) ([6b1da46](https://github.com/promotedai/promoted-ts-client/commit/6b1da465b6810585ceaa878ed4aa9e457663a7cd))


### Features

* switch pagetype to insertionstart ([#74](https://github.com/promotedai/promoted-ts-client/issues/74)) ([62dd4e8](https://github.com/promotedai/promoted-ts-client/commit/62dd4e88c177382806b3989d3c2e110750ab8708))


### BREAKING CHANGES

* putting this on this PR since the last one failed to build.

This PR also updates the version in package.json
* This does a breaking change to the DeliveryRequest interface.

Motivation: support sending request insertions in blocks.

TESTING=unit tests

# [8.4.0](https://github.com/promotedai/promoted-ts-client/compare/v8.3.2...v8.4.0) (2022-05-04)


### Features

* support client-specified clientinfo ([#71](https://github.com/promotedai/promoted-ts-client/issues/71)) ([1393ef4](https://github.com/promotedai/promoted-ts-client/commit/1393ef40056fea8e9a758f858af641a090479e34))

## [8.3.2](https://github.com/promotedai/promoted-ts-client/compare/v8.3.1...v8.3.2) (2022-04-21)


### Bug Fixes

* the string version ([#69](https://github.com/promotedai/promoted-ts-client/issues/69)) ([8082892](https://github.com/promotedai/promoted-ts-client/commit/808289289ce11997bfc1776355b7f987d5dc1a81))

## [8.3.1](https://github.com/promotedai/promoted-ts-client/compare/v8.3.0...v8.3.1) (2022-04-14)


### Bug Fixes

* the patch version ([#63](https://github.com/promotedai/promoted-ts-client/issues/63)) ([bafa655](https://github.com/promotedai/promoted-ts-client/commit/bafa655b0afc9ed42044c125b07f876f699f6d9e))

# [8.3.0](https://github.com/promotedai/promoted-ts-client/compare/v8.2.0...v8.3.0) (2022-04-14)


### Features

* add clientrequestid to errors ([#62](https://github.com/promotedai/promoted-ts-client/issues/62)) ([f62943a](https://github.com/promotedai/promoted-ts-client/commit/f62943ae1d7fece8cc26d6ed270267ee5996b881))

# [8.2.0](https://github.com/promotedai/promoted-ts-client/compare/v8.1.0...v8.2.0) (2022-03-30)


### Features

* Bump version for Browser.referrer field\rTESTING=unit ([#61](https://github.com/promotedai/promoted-ts-client/issues/61)) ([5bf8760](https://github.com/promotedai/promoted-ts-client/commit/5bf876029ef68d081490142b67578a2fed00df4c))

# [8.1.0](https://github.com/promotedai/promoted-ts-client/compare/v8.0.0...v8.1.0) (2022-03-10)


### Features

* hasinsertionid requires insertionid field ([#57](https://github.com/promotedai/promoted-ts-client/issues/57)) ([90efea6](https://github.com/promotedai/promoted-ts-client/commit/90efea6877ce7c4262e69603ca530d5548573d2a))

# [8.0.0](https://github.com/promotedai/promoted-ts-client/compare/v7.5.0...v8.0.0) (2022-03-10)


### Features

* a commit to force a breaking change ([#56](https://github.com/promotedai/promoted-ts-client/issues/56)) ([b2f256f](https://github.com/promotedai/promoted-ts-client/commit/b2f256ffe1416c724e604c97f500d79263bdf9e6))


### BREAKING CHANGES

* see commit 6eae974200351d564e52b49aa163eae6fb19a41d for multiple breaking changes

TESTING=none

# [7.5.0](https://github.com/promotedai/promoted-ts-client/compare/v7.4.0...v7.5.0) (2022-03-10)


### Features

* simplify interface ([#55](https://github.com/promotedai/promoted-ts-client/issues/55)) ([6eae974](https://github.com/promotedai/promoted-ts-client/commit/6eae974200351d564e52b49aa163eae6fb19a41d))

# [7.4.0](https://github.com/promotedai/promoted-ts-client/compare/v7.3.0...v7.4.0) (2022-02-24)


### Features

* Max request insertions\rTESTING=unit ([#53](https://github.com/promotedai/promoted-ts-client/issues/53)) ([f147946](https://github.com/promotedai/promoted-ts-client/commit/f147946037afcdfde5356212a92a397a3fda8121))

# [7.3.0](https://github.com/promotedai/promoted-ts-client/compare/v7.2.1...v7.3.0) (2021-12-20)


### Features

* Fill in DeliveryExecution.serverVersion\rTESTING=unit ([#49](https://github.com/promotedai/promoted-ts-client/issues/49)) ([a9d849f](https://github.com/promotedai/promoted-ts-client/commit/a9d849ff3dc129a3cc265b9eee4f760da4609b9a))

## [7.2.1](https://github.com/promotedai/promoted-ts-client/compare/v7.2.0...v7.2.1) (2021-11-16)


### Bug Fixes

* how shadow traffic impacts with compact insertions fn ([#48](https://github.com/promotedai/promoted-ts-client/issues/48)) ([6e41c40](https://github.com/promotedai/promoted-ts-client/commit/6e41c405b3f8f607c8f190336ebac62ea11e9b73))

# [7.2.0](https://github.com/promotedai/promoted-ts-client/compare/v7.1.0...v7.2.0) (2021-10-07)


### Features

* switching to log using DeliveryLog ([#45](https://github.com/promotedai/promoted-ts-client/issues/45)) ([e18ca2f](https://github.com/promotedai/promoted-ts-client/commit/e18ca2ff202d9a8b0d14dd6cec7d4391a11ef2c0))

# [7.1.0](https://github.com/promotedai/promoted-ts-client/compare/v7.0.0...v7.1.0) (2021-09-17)


### Features

* Fix onlyLog doc\rTESTING=manual ([#43](https://github.com/promotedai/promoted-ts-client/issues/43)) ([646f60d](https://github.com/promotedai/promoted-ts-client/commit/646f60d0fb94a579adc177222c4b7a1fb304bdc5))

# [7.0.0](https://github.com/promotedai/promoted-ts-client/compare/v6.6.0...v7.0.0) (2021-07-30)


### Code Refactoring

* change compact*Insertions to compact*Properties ([2b8f5d0](https://github.com/promotedai/promoted-ts-client/commit/2b8f5d087d1bfd8ef2350cad27cd0b20f2cad3f6))


### BREAKING CHANGES

* this forces clients to change.  This will be a major version change.

TESTING=unit tests

# [6.6.0](https://github.com/promotedai/promoted-ts-client/compare/v6.5.1...v6.6.0) (2021-07-21)


### Features

* InsertionPageType on prepareForLogging\rTESTING=unit ([#28](https://github.com/promotedai/promoted-ts-client/issues/28)) ([24baa8a](https://github.com/promotedai/promoted-ts-client/commit/24baa8a8b56b3d8e394432ab58a2766249f09ee3))

## [6.5.1](https://github.com/promotedai/promoted-ts-client/compare/v6.5.0...v6.5.1) (2021-07-21)


### Bug Fixes

* a hanging Promise ([ad52228](https://github.com/promotedai/promoted-ts-client/commit/ad52228d354a0e88f9ff7d0aa6c5c7e3cf1f7dc2))

# [6.5.0](https://github.com/promotedai/promoted-ts-client/compare/v6.4.0...v6.5.0) (2021-06-19)


### Features

* First cut at shadow traffic support\rTESTING=unit ([#26](https://github.com/promotedai/promoted-ts-client/issues/26)) ([f7edd16](https://github.com/promotedai/promoted-ts-client/commit/f7edd1604933f8ba43853c53d82e9ce912522479))

# [6.4.0](https://github.com/promotedai/promoted-ts-client/compare/v6.3.0...v6.4.0) (2021-06-17)


### Features

* createLogRequest function\rTESTING=unit ([#25](https://github.com/promotedai/promoted-ts-client/issues/25)) ([19627ce](https://github.com/promotedai/promoted-ts-client/commit/19627ce17080b42e3ce31fd42cc48dbbb7d7b377))

# [6.3.0](https://github.com/promotedai/promoted-ts-client/compare/v6.2.0...v6.3.0) (2021-06-15)


### Features

* Don't keep redundant userInfos on children of LogRequest\rTESTING=unit ([3951df6](https://github.com/promotedai/promoted-ts-client/commit/3951df6094b5e5494dfa91721156523f8e4d801b))

# [6.2.0](https://github.com/promotedai/promoted-ts-client/compare/v6.1.0...v6.2.0) (2021-06-15)


### Features

* Add paging, deprecate limit ([98beb9a](https://github.com/promotedai/promoted-ts-client/commit/98beb9a14f964dea961c9cc87a13eaabea5fe784))

# [6.1.0](https://github.com/promotedai/promoted-ts-client/compare/v6.0.2...v6.1.0) (2021-04-28)


### Features

* fill in Insertion.position for metrics logging ([5f17045](https://github.com/promotedai/promoted-ts-client/commit/5f17045b2917a1ff14925a017393cfa52b2c7b65))

## [6.0.2](https://github.com/promotedai/promoted-ts-client/compare/v6.0.1...v6.0.2) (2021-04-22)


### Bug Fixes

* response insertion logging ([526a14d](https://github.com/promotedai/promoted-ts-client/commit/526a14d95c7febe01462284cc07045c730a9c0dd))

## [6.0.1](https://github.com/promotedai/promoted-ts-client/compare/v6.0.0...v6.0.1) (2021-04-22)


### Bug Fixes

* simplify the new log function ([1d99374](https://github.com/promotedai/promoted-ts-client/commit/1d99374d2b8ab5e655924a494632b5ffcd0b7bb2))

# [6.0.0](https://github.com/promotedai/promoted-ts-client/compare/v5.6.0...v6.0.0) (2021-04-14)


### Features

* change prepareForLogging to be a sync method ([02e2fa0](https://github.com/promotedai/promoted-ts-client/commit/02e2fa0ba69ee3cd3df9d80bcde025491cbc954c))


### BREAKING CHANGES

* this changes the external library interface

# [5.6.0](https://github.com/promotedai/promoted-ts-client/compare/v5.5.0...v5.6.0) (2021-04-13)


### Features

* export schema types ([3f4f4f5](https://github.com/promotedai/promoted-ts-client/commit/3f4f4f5e1859c9b019f19506f2f99e0ed5dd539b))

# [5.5.0](https://github.com/promotedai/promoted-ts-client/compare/v5.4.0...v5.5.0) (2021-04-13)


### Features

* add a helper compact fn that strips properties ([be036ff](https://github.com/promotedai/promoted-ts-client/commit/be036ff19e305c30c3fdfcf5a7174b61dcbbbc04))

# [5.4.0](https://github.com/promotedai/promoted-ts-client/compare/v5.3.0...v5.4.0) (2021-04-13)


### Features

* performance - reduce unnecessary slices ([ed1a87c](https://github.com/promotedai/promoted-ts-client/commit/ed1a87c719cec0a40af27e4386f79ae0487aaa1c))

# [5.3.0](https://github.com/promotedai/promoted-ts-client/compare/v5.2.0...v5.3.0) (2021-04-13)


### Features

* add a log utility function to hide the promise ([51e5a92](https://github.com/promotedai/promoted-ts-client/commit/51e5a927d96924819b7a6e26e231e9aa62a80d7e))

# [5.2.0](https://github.com/promotedai/promoted-ts-client/compare/v5.1.0...v5.2.0) (2021-04-12)


### Features

* speed up prepare for logging ([7ceebaa](https://github.com/promotedai/promoted-ts-client/commit/7ceebaa0d21d035322cb6f38b3d4e6302941270e))

# [5.1.0](https://github.com/promotedai/promoted-ts-client/compare/v5.0.0...v5.1.0) (2021-04-12)


### Features

* change the default limit size ([4bc6876](https://github.com/promotedai/promoted-ts-client/commit/4bc6876f355a2de0939e481a76859708d6870d98))

# [5.0.0](https://github.com/promotedai/promoted-ts-client/compare/v4.0.0...v5.0.0) (2021-04-11)


### Code Refactoring

* make names consistent - fullInsertion ([381e1e5](https://github.com/promotedai/promoted-ts-client/commit/381e1e5884e897a397bd6691d69b7bd8650b892f))


### BREAKING CHANGES

* - this changes the external interface

# [4.0.0](https://github.com/promotedai/promoted-ts-client/compare/v3.0.0...v4.0.0) (2021-04-11)


### Features

* add library to help run experiments ([24a1b8a](https://github.com/promotedai/promoted-ts-client/commit/24a1b8a1bf1573e2251f69cdcf6517b988409520))


### BREAKING CHANGES

* this changes the external interface

# [3.0.0](https://github.com/promotedai/promoted-ts-client/compare/v2.0.0...v3.0.0) (2021-04-11)


### Features

* rename shouldOptimize to onlyLog ([7a5d984](https://github.com/promotedai/promoted-ts-client/commit/7a5d98435d5dd5dab9da4e0bbe05dc01d6d026e3))


### BREAKING CHANGES

* - this changes the interface

# [2.0.0](https://github.com/promotedai/promoted-ts-client/compare/v1.1.0...v2.0.0) (2021-04-11)


### Code Refactoring

* rename methods and variables ([5333b2a](https://github.com/promotedai/promoted-ts-client/commit/5333b2af2fd9c447ad65bb04619e2bc66facaaba))


### BREAKING CHANGES

* this changes the interface

# [1.1.0](https://github.com/promotedai/promoted-ts-client/compare/v1.0.0...v1.1.0) (2021-04-11)


### Bug Fixes

* uncomment unit tests ([82b60b8](https://github.com/promotedai/promoted-ts-client/commit/82b60b8fef8fbb797650cc29e916015522632ff3))


### Features

* support the ability to compact insertions ([0b94240](https://github.com/promotedai/promoted-ts-client/commit/0b94240719c2ed4a5bbb8dfd6eb2e2e04f50e081))

# 1.0.0 (2021-04-07)


### Features

* initial commit ([6c02b4e](https://github.com/promotedai/promoted-ts-client/commit/6c02b4e73bc322b8f6f5b8369444bf38c0bc5b79))
