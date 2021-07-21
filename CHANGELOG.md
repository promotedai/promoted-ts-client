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
