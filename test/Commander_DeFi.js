const { BN } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const truffleAssert = require('truffle-assertions');
const { functions } = require('lodash');
const M = require('minimatch');
const { execPath } = require('process');
const web3 = require('web3');
const { time } = require('@openzeppelin/test-helpers'); //require('openzeppelin-test-helpers');    

const Commander_DeFi = artifacts.require("Commander_DeFi");
const toBN = web3.utils.toBN;

contract("Commander_DeFi", accounts => {
    var communityAddressMock;
    var maintenanceAddressMock;
    var pancakeFactoryMock;
    var pancakeRouterMock;
    var contract;

    beforeEach(async function() {
        communityMock = accounts[7];
        maintenanceMock = accounts[8];
        liquidityWalletMock = accounts[9];

        contract = await Commander_DeFi.new(communityMock, maintenanceMock, liquidityWalletMock);
    });

    async function getReflectionFromToken(tokens) {
        totalSupply = await contract.totalSupply();
        rSupply = await contract.totalRSupply();
        rate = rSupply.div(totalSupply);
        return tokens.mul(rate);
    }

    async function timeIncreaseTo (seconds) {
        const delay = 1000 - new Date().getMilliseconds();
        await new Promise(resolve => setTimeout(resolve, delay));
        await time.increaseTo(seconds);
    }

    async function timeIncreaseToBlock (block) {
        await time.advanceBlock(block);
    }

    async function getTokensFromReflection(rTokens, tTokensToAdjust, rTokensToAdjust) {
        totalSupply = await contract.totalSupply();
        rSupply = await contract.totalRSupply();

        if (typeof tTokensToAdjust != "undefined") {
            totalSupply = totalSupply.sub(tTokensToAdjust);
        }

        if (typeof rTokensToAdjust != "undefined") {
            rSupply = rSupply.sub(rTokensToAdjust);
        }

        rate = rSupply.div(totalSupply);
        return rTokens.div(rate);
    }

    describe("setup", async() => {
        
        it("should have Commander_DeFi as name", async() => {
            expect(await contract.name()).to.be.equal("Commander_DeFi");
        });
        it("should have $COMFI as symbol", async() => {
            expect(await contract.symbol()).to.be.equal("COMFI");
        });
        it("should have 18 decimals", async() => {
            expect(await contract.decimals()).to.be.bignumber.equal("18");
        });
        it("should have 100 trillion of total supply", async () => {
            totalSupply = await contract.totalSupply();
            expect(totalSupply).to.be.bignumber.equal(web3.utils.toWei("100000000000000"));
        });
        it("should have 100 trillion * 0.005 of max transaction amount", async () => {
            maxTxAmount = (await contract._maxTxAmount()).toString();
            maxTxAmountCalculatedWithTotalSupply = (await contract.totalSupply()).mul(web3.utils.toWei(toBN("5"))).div(web3.utils.toWei(toBN("1000"))).toString();
            expect(maxTxAmount).to.be.bignumber.equal(maxTxAmountCalculatedWithTotalSupply);
        });
        it("should have 1% tax fee", async() => {
            expect(await contract._taxFee()).to.be.bignumber.equal("100");
        });
        it("should have 3% community fee", async() => {
            expect(await contract._communityFee()).to.be.bignumber.equal("300");
        });
        it("should have 3% maintenance fee", async() => {
            expect(await contract._maintenanceFee()).to.be.bignumber.equal("300");
        });
        it("should have 3% liquidity wallet fee", async() => {
            expect(await contract._liquidityWalletFee()).to.be.bignumber.equal("300");
        });   
        it("should not allow to change maintenance wallet address", async() => {
            hasError = false;
            try {
                await contract.setMaintenanceAddress(accounts[4], {from: accounts[2]});
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Ownable: caller is not the owner")).to.be.greaterThanOrEqual(0);
            }
            expect(hasError).to.be.equal(true);
            expect(await contract.maintenance()).to.be.equal(maintenanceMock);
        });

        it("should not allow to change community wallet address", async() => {
            hasError = false;
            try {
                await contract.setCommunityAddress(accounts[4], {from: accounts[2]});
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Ownable: caller is not the owner")).to.be.greaterThanOrEqual(0);
            }
            expect(hasError).to.be.equal(true);
            expect(await contract.community()).to.be.equal(communityMock);
        });

        it("should not allow to change liquidity wallet address", async() => {
            hasError = false;
            try {
                await contract.setLiquidityWalletAddress(accounts[4], {from: accounts[2]});
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Ownable: caller is not the owner")).to.be.greaterThanOrEqual(0);
            }
            expect(hasError).to.be.equal(true);
            expect(await contract.liquidityWallet()).to.be.equal(liquidityWalletMock);
        });
    });

    describe("ownership transfer", async() => {

/*         it("should not allow to transfer ownership when timelocked", async() => {
            await truffleAssert.reverts(contract.transferOwnership(accounts[1]), "Function is timelocked")
        }); */

        it("should allow to transfer ownership, balance should be transfered as well", async() => {
            timeLock = await contract.timelock();
            oldOwner = await contract.owner();
            oldOwnerBalance = await contract.balanceOf(accounts[0]);
            tOldOwnerBalance = await contract.balanceOfT(accounts[0]);
            rOldOwnerBalance = await contract.balanceOfR(accounts[0]);

            await timeIncreaseTo(timeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year

            contract.transferOwnership(accounts[1]);
            newOwner = await contract.owner();
            newOwnerBalance = await contract.balanceOf(accounts[1]);
            tNewOwnerBalance = await contract.balanceOfT(accounts[1], {from:accounts[1]}); //need to specify the new account since it's the new owner
            rNewOwnerBalance = await contract.balanceOfR(accounts[1], {from:accounts[1]}); //need to specify the new account since it's the new owner
            
            // old owner should not be equal to new owner
            expect(oldOwner).to.be.not.equal(newOwner);
            // validate that the owner is account 2
            expect(await contract.owner()).to.be.equal(accounts[1]);
            // validate all balances have been trasnfered
            expect(oldOwnerBalance).to.be.bignumber.equal(newOwnerBalance);
            expect(tOldOwnerBalance).to.be.bignumber.equal(tNewOwnerBalance);
            expect(rOldOwnerBalance).to.be.bignumber.equal(rNewOwnerBalance);
            
        });
    });
    describe("transfers", async() => {
        
        it("should transfer balance to another account", async () => {
            creatorInitialAccountBalance = await contract.balanceOf(accounts[0]);        
            initialAccountBalance = await contract.balanceOf(accounts[1]);
            
            await contract.transfer(accounts[1], 10000);
    
            finalAccountBalance = await contract.balanceOf(accounts[1]);
            creatorFinalAccountBalance = await contract.balanceOf(accounts[0]);
    
            expect(initialAccountBalance).to.be.bignumber.equal('0');        
            expect(finalAccountBalance).to.be.bignumber.equal('10000');
            expect(creatorFinalAccountBalance).to.be.bignumber.equal(creatorInitialAccountBalance.sub(toBN('10000')));
        });

        it("should increment holders balance when transaction occurs by the reflection amount", async () => {
            // transfer amount to account1
            await contract.transfer(accounts[1], web3.utils.toWei("100"));
            
            // transfer tokens to other accounts (account2 and account3)
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], 1000);
            
            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("100"), {from: accounts[2]});

            tokensRelatedToReflection = web3.utils.toWei(toBN("100"));
            rTokensToAccount = await getReflectionFromToken(tokensRelatedToReflection);
        
            // calculate tokens from accounts excluded from rewards
            let tTokensToCommunity = web3.utils.toWei(toBN("100")).mul(toBN("300")).div(toBN("10000"));
            let tTokensToMaintenance = web3.utils.toWei(toBN("100")).mul(toBN("300")).div(toBN("10000"));
            let tTokensToLiquidity = web3.utils.toWei(toBN("100")).mul(toBN("300")).div(toBN("10000"));
            let rTokensToCommunity = await getReflectionFromToken(tTokensToCommunity);
            let rTokensToMaintenance = await getReflectionFromToken(tTokensToMaintenance);
            let rTokensToLiquidity = await getReflectionFromToken(tTokensToLiquidity);
            let tTokensToAdjust = tTokensToMaintenance.add(tTokensToLiquidity).add(tTokensToCommunity);
            let rTokensToAdjust = rTokensToMaintenance.add(rTokensToLiquidity).add(rTokensToCommunity);

            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("100"));

            holderFinalAccountBalance = await contract.balanceOf(accounts[1]);
            balanceFromReflection = await getTokensFromReflection(rTokensToAccount, tTokensToAdjust, rTokensToAdjust);

            expect(holderFinalAccountBalance).to.be.bignumber.equal(balanceFromReflection);
        });

        it("should not allow transfers with negative values", async () => {
            // transfer amount to account1
            await contract.transfer(accounts[1], web3.utils.toWei("100"));
            
            // transfer tokens to other accounts (account2 and account3)
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], web3.utils.toWei("1000"));

            holderInitialAccountBalance = await contract.balanceOf(accounts[1]);
            
            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("100"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            let hasError = false;
            try{
                await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("-1"));
            } catch(e) {
                hasError = true;
            }

            holderFinalAccountBalance = await contract.balanceOf(accounts[1]);            
            expect(holderFinalAccountBalance).to.be.bignumber.equal(holderInitialAccountBalance);
            expect(hasError).to.be.equal(true);
        });

        it("should not allow transfers with zero value", async () => {
            // transfer amount to account1
            await contract.transfer(accounts[1], web3.utils.toWei("100"));
            
            // transfer tokens to other accounts (account2 and account3)
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], web3.utils.toWei("1000"));

            holderInitialAccountBalance = await contract.balanceOf(accounts[1]);
            
            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("100"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            let hasError = false;
            try {
                await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("0"));
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("amount must be greater than zero")).to.be.greaterThanOrEqual(0);
            }

            holderFinalAccountBalance = await contract.balanceOf(accounts[1]);            
            expect(holderFinalAccountBalance).to.be.bignumber.equal(holderInitialAccountBalance);
            expect(hasError).to.be.equal(true);
        });

        it("should not allow transfers without allowance", async () => {
            // transfer amount to account1
            await contract.transfer(accounts[1], web3.utils.toWei("100"));
            
            // transfer tokens to other accounts (account2 and account3)
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], web3.utils.toWei("1000"));

            holderInitialAccountBalance = await contract.balanceOf(accounts[1]);
                    
            // transfer amount from account2 to account3
            let hasError = false;
            try {
                await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("100"));
            } catch (e) {
                hasError = true;
                expect(e.reason.indexOf("transfer amount exceeds allowance")).to.be.greaterThanOrEqual(0);
            }

            holderFinalAccountBalance = await contract.balanceOf(accounts[1]);            
            expect(holderFinalAccountBalance).to.be.bignumber.equal(holderInitialAccountBalance);
            expect(hasError).to.be.equal(true);
        });

        it("should not allow transfers with an allowance lower than the transfer", async () => {
            // transfer amount to account1
            await contract.transfer(accounts[1], web3.utils.toWei("100"));
            
            // transfer tokens to other accounts (account2 and account3)
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], web3.utils.toWei("1000"));

            holderInitialAccountBalance = await contract.balanceOf(accounts[1]);
            
            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("50"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            let hasError = false;
            try{
                await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("100"));
            }catch(e){
                hasError = true;
                expect(e.reason.indexOf("transfer amount exceeds allowance")).to.be.greaterThanOrEqual(0);
            }

            holderFinalAccountBalance = await contract.balanceOf(accounts[1]);            
            expect(holderFinalAccountBalance).to.be.bignumber.equal(holderInitialAccountBalance);
            expect(hasError).to.be.equal(true);
        });

        it("should not increment holders balance when transaction occurs if excluded from fee and should not increment the totalTokensTransferred", async () => {
            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year
            // transfer amount to account1
            await contract.transfer(accounts[1], web3.utils.toWei("100"));
    
            // save balance
            holderInitialAccountBalance = await contract.balanceOf(accounts[1]);
            
            // transfer tokens to other accounts (account2 and account3)
            await contract.excludeFromFee(accounts[2])
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], 1000);
    
            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("200"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("200"));
    
            // get current balance from account1
            holderFinalAccountBalance = await contract.balanceOf(accounts[1]);
            
            // transfer between account2 and account3 should add fee to account1
            expect(holderFinalAccountBalance).to.be.bignumber.equal(holderInitialAccountBalance);
            
            // no tokens should have been donated to Commander_DeFi so the totalTokensTransferred should be zero.
            expect(await contract.getTotalTokensTransferredHistory(accounts[2])).to.be.bignumber.equal(web3.utils.toWei("0"));
        });

        it("should not add liquidity when transaction occurs", async () => {
            // save balance
            initialContractAccountBalance = await contract.balanceOf(contract.address);
            
            // transfer tokens to other accounts (account2 and account3)
            await contract.includeInFee(accounts[2]);
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], 1000);
    
            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("200"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("100"));
    
            // get current balance from account1
            finalContractAccountBalance = await contract.balanceOf(contract.address);
            
            // transfer between account2 and account3 should add fee to account1
            expect(finalContractAccountBalance).to.be.bignumber.equal(initialContractAccountBalance);
        });

        it("should increase tOwned on transfer to excluded", async () => {

            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year
            // transfer tokens to other accounts (account2 and account3)
            await contract.excludeFromReward(accounts[3]);
            //tOwnedInitialBalance = await contract.balanceOf(accounts[3]);
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[1], web3.utils.toWei("100"));

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("100"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transfer(accounts[3], web3.utils.toWei("100"), {from: accounts[2]});

            // get current balance from account1
            tOwnedFinalBalanceRecipient = await contract.balanceOf(accounts[3]);
            tOwnedFinalBalanceSender = await contract.balanceOf(accounts[2]);
            tOwnedFinalBalanceCheckAccount = await contract.balanceOf(accounts[1]);
            
            // transfer between account2 and account3 should add fee to account1
            expect(tOwnedFinalBalanceRecipient).to.be.bignumber.equal(web3.utils.toWei("96"));
            expect(tOwnedFinalBalanceSender).to.be.bignumber.equal(tOwnedFinalBalanceCheckAccount); // Check account should have the same balance as the sender account after the transfer 

        });

        it("should decrease tOwned on transfer from excluded", async () => {
            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year

            await contract.excludeFromReward(accounts[2]);
            //tOwnedInitialBalance = await contract.balanceOf(accounts[3]);
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[1], web3.utils.toWei("96"));

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("100"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transfer(accounts[3], web3.utils.toWei("100"), {from: accounts[2]});

            // get current balance from account1
            tOwnedFinalBalanceSender = await contract.balanceOf(accounts[2]);
            rOwnedFinalBalanceRecipient = await contract.balanceOf(accounts[3]);
            rOwnedFinalBalanceCheckAccount = await contract.balanceOf(accounts[1]);
            
            // transfer between account2 and account3 should add fee to account1
            expect(tOwnedFinalBalanceSender).to.be.bignumber.equal(web3.utils.toWei("100"));
            expect(rOwnedFinalBalanceRecipient).to.be.bignumber.equal(rOwnedFinalBalanceCheckAccount); // Check account should have the same balance as the sender account after the transfer 

        });

        it("should decrease tOwned on both sender and recipient on both excluded", async () => {
            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year

            await contract.excludeFromReward(accounts[2]);
            await contract.excludeFromReward(accounts[3]);
            
            await contract.transfer(accounts[2], web3.utils.toWei("200"));

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("100"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transfer(accounts[3], web3.utils.toWei("100"), {from: accounts[2]});

            // get current balance from account1
            tOwnedFinalBalanceSender = await contract.balanceOf(accounts[2]);
            tOwnedFinalBalanceRecipient = await contract.balanceOf(accounts[3]);
            
            // transfer between account2 and account3 should add fee to account1
            expect(tOwnedFinalBalanceSender).to.be.bignumber.equal(web3.utils.toWei("100"));
            expect(tOwnedFinalBalanceRecipient).to.be.bignumber.equal(web3.utils.toWei("96")); // Check account should have the same balance as the sender account after the transfer 

        });
        
        it("should allow max tx transfer", async () => {
            
            
            await contract.transfer(accounts[2], web3.utils.toWei("540000"));

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("540000"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transfer(accounts[3], web3.utils.toWei("540000"), {from: accounts[2]});

            tOwnedFinalBalanceSender = await contract.balanceOf(accounts[2]);
            
            // transfer between account2 and account3 should add fee to account1
            expect(tOwnedFinalBalanceSender).to.be.bignumber.equal(web3.utils.toWei("0"));

        });

        it("should not allow over max tx transfer", async () => {
            
            await contract.transfer(accounts[2], web3.utils.toWei("540001"));

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("540001"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            let hasError = false;
            try{
                await contract.transfer(accounts[3], web3.utils.toWei("540001"), {from: accounts[2]});
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Transfer amount exceeds the maxTxAmount.")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(true);
        });
        
    });
    

    describe("fees", async () => {   
        it("should add 3% tokens to community when transaction occurs and track that tokens deducted have been accounted in totalTokensTransfer", async () => {
            initialCommunityBalance = await contract.balanceOf(communityMock);

            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], 1000);

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("200"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("200"));

            finalCommunityBalance = await contract.balanceOf(communityMock);
            
            //community address should receive 3%
            expect(finalCommunityBalance).to.be.bignumber.equal(initialCommunityBalance.add(web3.utils.toWei(toBN("200")).mul(toBN("300")).div(toBN("10000"))));

            // balance that the account 2 has been taxed should be equal to the 10% rate (3% community, 3% maintenance, 3% liquidity wallet, 1% redistribution)
            expect(await contract.getTotalTokensTransferredHistory(accounts[2])).to.be.bignumber.equal(web3.utils.toWei(toBN("200")).mul(toBN("1000")).div(toBN("10000")));

        });

        it("should add 3% tokens + reflection to community when transaction occurs if community included in rewards", async () => {
            initialCommunityBalance = await contract.balanceOf(communityMock);
            await contract.includeInReward(communityMock);
            
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], 1000);

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("200"), {from: accounts[2]});

            // calculate tokens from accounts excluded from rewards
            let tTokensToMaintenance = web3.utils.toWei(toBN("200")).mul(toBN("300")).div(toBN("10000"));
            let tTokensToLiquidity = web3.utils.toWei(toBN("200")).mul(toBN("300")).div(toBN("10000"));
            let rTokensToMaintenance = await getReflectionFromToken(tTokensToMaintenance);
            let rTokensToLiquidity = await getReflectionFromToken(tTokensToLiquidity);
            let tTokensToAdjust = tTokensToMaintenance.add(tTokensToLiquidity);
            let rTokensToAdjust = rTokensToMaintenance.add(rTokensToLiquidity);

            tokensToCommunity = web3.utils.toWei(toBN("200")).mul(toBN("300")).div(toBN("10000"));
            rTokensToCommunity = await getReflectionFromToken(tokensToCommunity);
            
            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("200"));

            finalCommunityBalance = await contract.balanceOf(communityMock);
            communityBalanceFromReflection = await getTokensFromReflection(rTokensToCommunity, tTokensToAdjust, rTokensToAdjust);
            
            expect(finalCommunityBalance).to.be.bignumber.equal(communityBalanceFromReflection);
        });

        it("should add 3% tokens to developers when transaction occurs and track that tokens deducted have been accounted in totalTokensTransfer", async () => {
            initialMaintenanceBalance = await contract.balanceOf(maintenanceMock);

            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], 1000);

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("200"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("200"));

            finalMaintenanceBalance = await contract.balanceOf(maintenanceMock);
            
            expect(finalMaintenanceBalance).to.be.bignumber.equal(initialMaintenanceBalance.add(web3.utils.toWei(toBN("200")).mul(toBN("300")).div(toBN("10000"))));

            // balance that the account 2 has been taxed should be equal to the 10% rate (3% community, 3% maintenance, 3% liquidity wallet, 1% redistribution)
            expect(await contract.getTotalTokensTransferredHistory(accounts[2])).to.be.bignumber.equal(web3.utils.toWei(toBN("200")).mul(toBN("1000")).div(toBN("10000")));
        });

        it("should add 3% tokens to liquidity wallet when transaction occurs and track that tokens deducted have been accounted in totalTokensTransfer", async () => {
            initialLiquidityWalletBalance = await contract.balanceOf(liquidityWalletMock);

            await contract.transfer(accounts[2], web3.utils.toWei("2000"));
            await contract.transfer(accounts[3], 1000);

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("2000"), {from: accounts[2]});
        
            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("2000"));

            finalLiquidityWalletBalance = await contract.balanceOf(liquidityWalletMock);
            
            expect(finalLiquidityWalletBalance).to.be.bignumber.equal(initialLiquidityWalletBalance.add(web3.utils.toWei(toBN("2000")).mul(toBN("300")).div(toBN("10000"))));

            // balance that the account 2 has donated should be equal to the 10% rate (3% community, 3% maintenance, 3% liquidity wallet, 1% redistribution)
            expect(await contract.getTotalTokensTransferredHistory(accounts[2])).to.be.bignumber.equal(web3.utils.toWei(toBN("2000")).mul(toBN("1000")).div(toBN("10000")));
        });

        it("should add 3% tokens + reflection to maintenance when transaction occurs if community included in rewards", async () => {
            await contract.includeInReward(maintenanceMock);
            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], 1000);

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("200"), {from: accounts[2]});

            // calculate tokens from accounts excluded from rewards
            let tTokensToCommunity = web3.utils.toWei(toBN("200")).mul(toBN("300")).div(toBN("10000"));
            let tTokensToLiquidity = web3.utils.toWei(toBN("200")).mul(toBN("300")).div(toBN("10000"));
            let rTokensToCommunity = await getReflectionFromToken(tTokensToCommunity);
            let rTokensToLiquidity = await getReflectionFromToken(tTokensToLiquidity);
            let tTokensToAdjust = tTokensToCommunity.add(tTokensToLiquidity);
            let rTokensToAdjust = rTokensToCommunity.add(rTokensToLiquidity);

            tokensToMaintenance = web3.utils.toWei(toBN("200")).mul(toBN("300")).div(toBN("10000"));
            rTokensToMaintenance = await getReflectionFromToken(tokensToMaintenance);
        
            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("200"));

            finalMaintenanceBalance = await contract.balanceOf(maintenanceMock);
            maintenanceBalanceFromReflection = await getTokensFromReflection(rTokensToMaintenance, tTokensToAdjust, rTokensToAdjust);
            
            expect(finalMaintenanceBalance).to.be.bignumber.equal(maintenanceBalanceFromReflection);
        });

        it("should add 1% (change fee rate) tokens to community when transaction occurs", async () => {
            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year

            initialCommunityBalance = await contract.balanceOf(communityMock);

            await contract.transfer(accounts[2], web3.utils.toWei("200"));
            await contract.transfer(accounts[3], 1000);

            // allow sender to transfer amount from account2 and account3
            await contract.increaseAllowance(accounts[0], web3.utils.toWei("200"), {from: accounts[2]});

            // set the fee perc from 1% to 15%
            await contract.setCommunityFeePercent(100);

            // calculate reflection to maintenance
            tokensToCommunity = web3.utils.toWei(toBN("100")).mul(toBN("100")).div(toBN("10000"));
            rTokensToCommunity = await getReflectionFromToken(tokensToCommunity);
        
            // transfer amount from account2 to account3
            await contract.transferFrom(accounts[2], accounts[3], web3.utils.toWei("100"));

            finalCommunityBalance = await contract.balanceOf(communityMock);

            expect(finalCommunityBalance).to.be.bignumber.equal(initialCommunityBalance.add(web3.utils.toWei(toBN("100")).mul(toBN("100")).div(toBN("10000"))));
        });

        it("should allow setting less than 1% tax fee", async () => {
            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year

            var hasError = false;
            try {
                await contract.setTaxFeePercent(0);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(false);
        });

        it("should allow setting less than 3% maintenance fee", async () => {
            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year

            var hasError = false;
            try {
                await contract.setMaintenanceFeePercent(0);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(false);
        });

        it("should allow setting less than 3% liquidity wallet fee", async () => {
            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year

            var hasError = false;
            try {
                await contract.setLiquidityWalletFeePercent(0);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(false);
        });

        it("should allow setting less than 3% community fee", async () => {
            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year

            var hasError = false;
            try {
                await contract.setCommunityFeePercent(40);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(false);
        });

        it("should allow setting 1% tax fee", async () => {
            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year

            var hasError = false;
            try {
                await contract.setTaxFeePercent(30);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(false);
        });

        it("should allow setting 3% maintenance fee", async () => {
            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year

            var hasError = false;
            try {
                await contract.setMaintenanceFeePercent(90);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(false);
        });

        it("should allow setting 3% liquidity wallet fee", async () => {
            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year

            var hasError = false;
            try {
                await contract.setLiquidityWalletFeePercent(30);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(false);
        });

        it("should allow setting 3% community fee", async () => {
            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year

            var hasError = false;
            try {
                await contract.setCommunityFeePercent(250);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(false);
        });

        it("should not allow setting more than 1% tax fee", async () => {
            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year

            var hasError = false;
            try {
                await contract.setTaxFeePercent(31);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(true);
        });

        it("should not allow setting more than 3% maintenance fee", async () => {
            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year

            var hasError = false;
            try {
                await contract.setMaintenanceFeePercent(91);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(true);
        });

        it("should not allow setting more than 3% liquidity wallet fee", async () => {
            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year

            var hasError = false;
            try {
                await contract.setLiquidityWalletFeePercent(31);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(true);
        });

        it("should not allow setting more than 3% community fee", async () => {
            previousTimeLock = await contract.timelock();
            await timeIncreaseTo(previousTimeLock.add(time.duration.years(1)).subn(1)); // fast forward 1 year

            var hasError = false;
            try {
                await contract.setCommunityFeePercent(251);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("Cannot set percentage over")).to.be.greaterThanOrEqual(0);
            }

            expect(hasError).to.be.equal(true);
        });

        it("should not allow setting negative community fee", async () => {
            var hasError = false;
            try{
                await contract.setCommunityFeePercent(-10);
            } catch(e) {
                hasError = true;
                expect(e.reason.indexOf("value out-of-bounds")).to.be.greaterThanOrEqual(0);
            }
            expect(hasError).to.be.equal(true);
        }); 

        it("should not allow to set exclude from fee to any address which is not the owner", async () => {
            var hasError = false;
            try{
                await contract.excludeFromFee(accounts[2], {from:accounts[2]});
            }catch(e){
                hasError = true;
            }
            
            hasAccountBeenExcluded = await contract.isExcludedFromFee(accounts[2]);
            expect(hasAccountBeenExcluded).to.be.false;
            expect(hasError).to.be.equal(true);
        });

        it("should not allow to set exclude from rewards to any address which is not the owner", async () => {
            var hasError = false;
            try{
                await contract.excludeFromReward(accounts[2], {from:accounts[2]});
            }catch(e){
                hasError = true;
            }
            
            hasAccountBeenExcluded = await contract.isExcludedFromFee(accounts[2]);
            expect(hasAccountBeenExcluded).to.be.false;
            expect(hasError).to.be.equal(true);
        });
    });
});

