import { Chain, allChains } from "@thirdweb-dev/chains";
import {
  ConnectWallet,
  ThirdwebProvider,
  useAddress,
  useChain,
  useContract,
  useNetworkMismatch,
  useSDK,
  useSwitchChain,
} from "@thirdweb-dev/react";
import {
  ClaimConditionInput,
  NATIVE_TOKEN_ADDRESS,
  NFTContractDeployMetadata,
  NFTDrop,
  ThirdwebSDK,
} from "@thirdweb-dev/sdk";
import { BigNumber } from "ethers";
import { useRef, useState } from "react";

const clientId = process.env.NEXT_PUBLIC_CLIENT_ID;

type OwnedToken = {
  owner: string;
  tokenId: number;
};

type LockedContractInfo = {
  contractAddress: string;
  chainSlug: string;
  totalClaimedSupply: BigNumber;
  totalUnclaimedSupply: BigNumber;
  totalCount: BigNumber;
  contractType:
    | "custom"
    | "edition-drop"
    | "edition"
    | "marketplace"
    | "marketplace-v3"
    | "multiwrap"
    | "nft-collection"
    | "nft-drop"
    | "pack"
    | "signature-drop"
    | "split"
    | "token-drop"
    | "token"
    | "vote";
  allOwners: OwnedToken[];
  allTokenUris: string[];
  metadata: NFTContractDeployMetadata;
  primarySaleRecipient: string;
  platformFeesInfo: {
    platform_fee_basis_points: number;
    platform_fee_recipient: string;
  };
};

export default function Home() {
  const [lockedContract, setLockedContract] = useState<LockedContractInfo>();
  const [isLoadingLockedContract, setIsLoadingLockedContract] = useState(false);
  const lockedContractRef = useRef<HTMLInputElement>(null);
  const lockedChainSlugRef = useRef<HTMLInputElement>(null);

  const loadContract = async () => {
    const contractAddress = lockedContractRef.current?.value;
    if (!contractAddress) {
      return alert(
        "Please enter the contract address that you locked using our Mitigate tool"
      );
    }
    const chainSlug = lockedChainSlugRef.current?.value;
    if (!chainSlug) {
      return alert(
        "Please enter the network that the locked contract was deployed on"
      );
    }
    try {
      setIsLoadingLockedContract(true);
      const sdk = new ThirdwebSDK(chainSlug, { clientId });
      const lockedContract = await sdk.getContract(contractAddress);
      const isErc721 = "erc721" in lockedContract;
      const isErc1155 = "erc1155" in lockedContract;
      if (isErc721) {
        const [
          totalClaimedSupply,
          totalUnclaimedSupply,
          totalCount,
          contractType,
          metadata,
          primarySaleRecipient,
          platformFeesInfo,
        ] = await Promise.all([
          lockedContract.erc721.totalClaimedSupply(),
          lockedContract.erc721.totalUnclaimedSupply(),
          lockedContract.erc721.totalCount(),
          sdk.resolveContractType(contractAddress),
          lockedContract.metadata.get(),
          lockedContract.call("primarySaleRecipient", []),
          lockedContract.platformFees.get(),
        ]);
        const allTokenIds: number[] = Array.from(
          { length: totalCount.toNumber() },
          (_, index) => index
        );
        if (metadata) {
          if (metadata.name && metadata.name.endsWith("[Locked]"))
            metadata.name = metadata.name.replace("[Locked]", "").trim();
        }
        let allTokenUris: string[] = [];

        /**
         * For Starter tier there's a 100 RPC requests per second
         * so we would have to break the array into chunks and fetch the data _consequentially_
         * to prevent any unwanted request failure
         */
        const chunkSize = 100; // RPC limit
        const chunkedArrays: number[][] = [];
        for (let i = 0; i < allTokenIds.length; i += chunkSize) {
          const chunk = allTokenIds.slice(i, i + chunkSize);
          chunkedArrays.push(chunk);
        }
        for (let i = 0; i < chunkedArrays.length; i++) {
          const data = await Promise.all(
            chunkedArrays[i].map((tokenId) =>
              lockedContract.call("tokenURI", [tokenId])
            )
          );
          allTokenUris = allTokenUris.concat(data);
        }

        let allOwners: OwnedToken[] = [];

        if (totalUnclaimedSupply.gt(0)) {
          const claimedTokenIds = allTokenIds.slice(
            0,
            totalClaimedSupply.toNumber()
          );
          const chunkedArrays: number[][] = [];
          for (let i = 0; i < claimedTokenIds.length; i += chunkSize) {
            const chunk = claimedTokenIds.slice(i, i + chunkSize);
            chunkedArrays.push(chunk);
          }
          for (let i = 0; i < chunkedArrays.length; i++) {
            const data = await Promise.all(
              chunkedArrays[i].map((tokenId) =>
                lockedContract.erc721.ownerOf(tokenId)
              )
            );
            allOwners = allOwners.concat(
              data.map((owner, index) => ({
                owner,
                tokenId: allTokenIds.indexOf(chunkedArrays[i][index]),
              }))
            );
          }
        }
        setLockedContract({
          totalClaimedSupply,
          totalUnclaimedSupply,
          totalCount,
          contractType,
          allOwners,
          allTokenUris,
          contractAddress,
          chainSlug,
          metadata: metadata as NFTContractDeployMetadata,
          platformFeesInfo,
          primarySaleRecipient,
        });
      } else if (isErc1155) {
        alert("ERC1155 contract not supported yet. Stay tuned");
      }
    } catch (err) {
      console.log(err);
      setIsLoadingLockedContract(false);
    }
    setIsLoadingLockedContract(false);
  };

  return (
    <>
      <div className="text-black flex flex-col my-20">
        <div className="text-center text-white my-3">
          IMPORTANT: This tool only supports{" "}
          <a
            target="_blank"
            href="https://thirdweb.com/thirdweb.eth/DropERC721"
            className="text-blue-500 underline"
          >
            NFT Drop contracts
          </a>{" "}
          at the moment
        </div>
        <div className="mx-auto lg:w-[600px] flex flex-col gap-5 border rounded p-3">
          <div className="text-white text-lg font-bold">
            Step 1: Enter your locked contract
          </div>
          <input
            type="text"
            placeholder="Contract address"
            ref={lockedContractRef}
            className="px-3 py-2"
          />
          <input
            type="text"
            list="network-list"
            placeholder="ethereum"
            className="input input-bordered w-full px-3 py-2"
            ref={lockedChainSlugRef}
          />
          <datalist id="network-list">
            {allChains.map((item) => (
              <option key={item.chainId} value={item.slug}>
                {item.name}
              </option>
            ))}
          </datalist>

          <div>
            <button
              disabled={isLoadingLockedContract || Boolean(lockedContract)}
              onClick={loadContract}
              className="bg-white px-3 py-2 flex w-[200px] disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              {isLoadingLockedContract ? (
                <Spinner size={12} />
              ) : (
                <span className="m-auto">
                  {lockedContract ? "Contract loaded" : "Load contract"}
                </span>
              )}
            </button>
            <div className="text-xs text-white">
              It might take a few minutes to fetch all the data for large
              collections
            </div>
          </div>
          {lockedContract && (
            <div className="text-white">
              <hr />
              <div className="mt-3">
                <b className="text-green-500">Contract loaded:</b>{" "}
                <a
                  target="_blank"
                  className="text-blue-500"
                  href={`https://thirdweb.com/${lockedContract.chainSlug}/${lockedContract.contractAddress}`}
                >{`thirdweb.com/${lockedContract.chainSlug}/${lockedContract.contractAddress}`}</a>
              </div>
              <div>Contract type: {lockedContract.contractType}</div>
              <div>
                Claimed supply: {lockedContract.totalClaimedSupply.toString()}
              </div>
              <div>
                Unclaimed supply:{" "}
                {lockedContract.totalUnclaimedSupply.toString()}
              </div>
              <div>Total holders: {lockedContract.allOwners.length}</div>
            </div>
          )}
        </div>

        {/* Deploy new contract with the info gathered from `loadContract()` */}
        {lockedContract && (
          <SelectNewNetworkToDeploy lockedContract={lockedContract} />
        )}
      </div>
    </>
  );
}

const SelectNewNetworkToDeploy = ({
  lockedContract,
}: {
  lockedContract: LockedContractInfo;
}) => {
  const [chainToDeploy, setChainToDeploy] = useState<Chain>();
  const selectChainToDeploy = (slug: string) => {
    const chain = allChains.find((item) => item.slug === slug) ?? undefined;
    setChainToDeploy(chain);
  };
  return (
    <div className="mx-auto lg:w-[600px] flex flex-col gap-5 border rounded p-3 mt-5">
      <div className="text-white text-lg font-bold">
        Step 2: Deploy new contract
      </div>
      <div className="text-xs text-white">
        Select the (new) network to deploy
      </div>
      <input
        type="text"
        list="network-list-2"
        placeholder="ethereum"
        className="input input-bordered w-full px-3 py-2"
        onChange={(e) => selectChainToDeploy(e.target.value)}
      />
      <datalist id="network-list-2">
        {allChains.map((item, index) => (
          <option key={item.chainId} value={item.slug}>
            {item.name}
          </option>
        ))}
      </datalist>
      {chainToDeploy && (
        <ThirdwebProvider activeChain={chainToDeploy} clientId={clientId}>
          <div className="text-xs text-white">
            Deploying <b>{lockedContract.contractType}</b> contract on{" "}
            {chainToDeploy.name} (chainId: {chainToDeploy.chainId})
          </div>
          <DeployNftDrop
            lockedContract={lockedContract}
            deployChain={chainToDeploy}
          />
        </ThirdwebProvider>
      )}
    </div>
  );
};

const DeployNftDrop = ({
  lockedContract,
  deployChain,
}: {
  lockedContract: LockedContractInfo;
  deployChain: Chain;
}) => {
  const sdk = useSDK();
  const chain = useChain();
  const isMismatched = useNetworkMismatch();
  const switchChain = useSwitchChain();
  const address = useAddress();
  const [deployingContract, setDeployingContract] = useState<boolean>(false);
  const metadata: NFTContractDeployMetadata = {
    ...lockedContract.metadata,
    ...lockedContract.platformFeesInfo,
    primary_sale_recipient: lockedContract.primarySaleRecipient,
  };
  const [newContractAddress, setNewContractAddress] = useState<string>(
    "0x3984430c79DF7435c9282B33F37ED0e36106A376"
  );
  const deployContract = async () => {
    if (!sdk || !address) return;
    try {
      if (isMismatched) {
        await switchChain(deployChain.chainId);
      }
      setDeployingContract(true);
      const _newContractAddress = await sdk.deployer.deployBuiltInContract(
        lockedContract.contractType,
        metadata
      );
      setNewContractAddress(_newContractAddress);
    } catch (err) {
      console.log(err);
    }
    setDeployingContract(false);
  };

  const [lazyMintingNfts, setLazyMintingNfts] = useState<boolean>(false);
  const [lazyMintHash, setLazyMintHash] = useState<string>();
  const uploadNftsFromOldCollection = async () => {
    if (!sdk || !address || !newContractAddress) return;
    try {
      setLazyMintingNfts(true);
      const newContract = await sdk.getContract(newContractAddress, "nft-drop");
      const folderArrays: { [key: string]: string[] } = {};

      /**
       * An NFTDrop contract can have multiple batches (baseURIs)
       * so we have to lazyMint each batch separately
       * and batch them with `multicall`
       */
      lockedContract.allTokenUris
        .map((item) => item.replace("ipfs://", ""))
        .forEach((item) => {
          const [folder, value] = item.split("/");
          const baseUri = `ipfs://${folder}/`;
          if (!folderArrays[baseUri]) {
            folderArrays[baseUri] = [];
          }
          folderArrays[baseUri].push(`ipfs://${item}`);
        });
      const encoded = Object.keys(folderArrays).map((baseUri) =>
        newContract.encoder.encode("lazyMint", [
          folderArrays[baseUri].length, // _amount
          baseUri, // _baseURI
          "0x", // _extraData
        ])
      );
      const transaction = await newContract.call("multicall", [encoded]);
      setLazyMintHash(
        // @ts-ignore - what da hell some type errors here
        transaction.receipt?.transactionHash ?? "unable to fetch tx hash"
      );
    } catch (err) {
      console.log(err);
    }
    setLazyMintingNfts(false);
  };

  const newContractLink = `thirdweb.com/${chain?.slug}/${newContractAddress}`;
  const { contract: newContract } = useContract(newContractAddress, "nft-drop");

  /**
   * Download the snapshot content for AirdropERC721
   */
  const downloadAirdropContent = () => {
    const data = lockedContract.allOwners.map((item) => ({
      recipient: item.owner,
      tokenId: item.tokenId,
    }));
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snapshot_for_airdrop_erc721.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadSnapshot = () => {
    alert("Coming soon");
  };

  return (
    <>
      <div>
        <ConnectWallet switchToActiveChain={true} />
      </div>
      {address && !isMismatched && sdk && (
        <>
          {newContractAddress && newContract && (
            <div className="text-white">
              <div className="text-green-500 font-bold">
                New contract deployed successfully at:
              </div>
              <div>
                <a
                  className="text-blue-500 underline"
                  target="_blank"
                  href={`https://${newContractLink}`}
                >
                  {newContractLink}
                </a>
              </div>

              <div className="text-lg font-bold mt-10">
                Step 3: Upload {lockedContract.totalCount.toString()} NFTs from
                old collection
              </div>
              <div>
                <button
                  disabled={lazyMintingNfts || Boolean(lazyMintHash)}
                  className="bg-white px-3 py-2 flex w-[200px] text-black disabled:bg-gray-500 disabled:cursor-not-allowed"
                  onClick={uploadNftsFromOldCollection}
                >
                  {lazyMintingNfts ? (
                    <Spinner size={12} />
                  ) : (
                    <span className="mx-auto">
                      {lazyMintHash ? "Uploaded" : "Upload NFTs"}
                    </span>
                  )}
                </button>
              </div>
              {lazyMintHash ||
                (true && (
                  <>
                    <div className="mt-5">
                      <b className="text-green-500">Success</b> <br />
                      Transaction hash: {lazyMintHash}
                    </div>
                    <CreateOnlyOwnerPhaseAndDistribute
                      lockedContract={lockedContract}
                      address={address}
                      sdk={sdk}
                      newContract={newContract}
                    />
                  </>
                ))}
            </div>
          )}
        </>
      )}
    </>
  );
};

const CreateOnlyOwnerPhaseAndDistribute = ({
  lockedContract,
  newContract,
  sdk,
  address,
}: {
  lockedContract: LockedContractInfo;
  newContract: NFTDrop;
  sdk: ThirdwebSDK;
  address: string;
}) => {
  const [isSettingClaimPhase, setIsSettingClaimPhase] =
    useState<boolean>(false);
  const [claimPhaseAdded, setClaimPhaseAdded] = useState<boolean>(false);
  // Taken from Dashboard source code
  const DEFAULT_PHASE: ClaimConditionInput = {
    startTime: new Date(),
    maxClaimableSupply: "unlimited",
    maxClaimablePerWallet: "unlimited",
    waitInSeconds: "0",
    price: "0",
    currencyAddress: NATIVE_TOKEN_ADDRESS,
    snapshot: undefined,
    merkleRootHash: undefined,
    metadata: {
      name: "only-owner-claim-phase",
    },
  };

  const value = {
    ...DEFAULT_PHASE,
    maxClaimablePerWallet: "0",
    snapshot: address
      ? [
          {
            address: address,
            maxClaimable: "unlimited",
            price: "0",
          },
        ]
      : [],
  };

  const createOwnerOnlyClaimPhase = async () => {
    try {
      setIsSettingClaimPhase(true);
      await newContract.claimConditions.set([value]);
      setClaimPhaseAdded(true);
    } catch (err) {
      console.log(err);
    }
    setIsSettingClaimPhase(false);
  };

  const totalAmountToClaim = lockedContract.totalClaimedSupply.toString();

  return (
    <>
      <div className="mt-10">
        <div className="text-lg font-bold">
          Step 4: Claim {totalAmountToClaim} NFT(s)
        </div>
        <div>
          You had a total of {totalAmountToClaim} NFT(s) claimed from the old
          collection. You would need to distribute those tokens back to the
          holders
        </div>

        <div>
          {/* It says Claim on the button but it's actually "create claim phase" */}
          <button
            disabled={isSettingClaimPhase || claimPhaseAdded}
            className="bg-white px-3 py-2 flex w-[200px] text-black disabled:bg-gray-500 disabled:cursor-not-allowed"
            onClick={createOwnerOnlyClaimPhase}
          >
            {isSettingClaimPhase ? (
              <Spinner size={12} />
            ) : (
              <span className="m-auto">
                {claimPhaseAdded ? "Claimed" : "Claim"}
              </span>
            )}
          </button>
        </div>
      </div>

      {true && (
        <>
          <DistributeTokensViaClaiming
            newContract={newContract}
            address={address}
          />
        </>
      )}
    </>
  );
};

const DistributeTokensViaClaiming = ({
  newContract,
  address,
}: {
  newContract: NFTDrop;
  address: string;
}) => {
  const [isBatchClaiming, setIsBatchClaiming] = useState<boolean>(false);
  const [batchClaimed, setBatchClaimed] = useState<boolean>(false);

  const batchClaimingTokens = async () => {
    const test = await newContract.claimConditions.getActive();
    console.log({ test });
  };

  return (
    <>
      <div className="mt">
        <div>Step 5: Distribute tokens</div>
        <button
          disabled={isBatchClaiming || batchClaimed}
          className="bg-white px-3 py-2 flex w-[200px] text-black disabled:bg-gray-500 disabled:cursor-not-allowed"
          onClick={batchClaimingTokens}
        >
          {isBatchClaiming ? (
            <Spinner size={12} />
          ) : (
            <span className="m-auto">
              {batchClaimed ? "Distributed" : "Distribute"}
            </span>
          )}
        </button>
      </div>
    </>
  );
};

const Spinner = ({ size }: { size: number }) => {
  return (
    <div role="status" className="m-auto">
      <svg
        height={size}
        width={size}
        aria-hidden="true"
        className="text-black dark:text-white mr-2 h-8 w-8 animate-spin fill-white"
        viewBox="0 0 100 101"
        fill="none"
      >
        <path
          d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
};
