Deep copy your thirdweb NFTDrop contract and migrate it to another chain

- [x] Step 1: Load all the data from the "old" contract (data include: token holders, total item claimed, total item unclaimed, metadata etc.)
- [x] Step 2: Deploy new contract on a selected chain with the identical data copied from the old contract
- [x] Step 3: Upload (lazyMint) all the tokens from the old contract to the new one

---
If the old contract has some "x" amount of claimed items, you (as the contract owner) need to claim the same amount from the new contract, 
and distribute them to the token holders in the snapshot taken from the old contract in step 1

- [ ] Step 4: Create an onwer-only claim phase
- [ ] Step 5: Batch claim "x" token with each token set to its respective address from the said snapshot
