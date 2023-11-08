'use client';
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { LitAuthClient } from '@lit-protocol/lit-auth-client';
import { LitContracts } from '@lit-protocol/contracts-sdk';
import { ProviderType, AuthMethodType } from '@lit-protocol/constants';
import { PKPEthersWallet } from '@lit-protocol/pkp-ethers';
import { useState } from 'react';

// @ts-ignore
import dJSON from 'dirty-json';
import { ethers } from 'ethers';

export default function Home() {

  const [authMethod, setAuthMethod] = useState('');
  const [pkps, setPkps] = useState<any>([]);
  const [loading, setLoading] = useState(false);


  const getContext = async (): Promise<{
    _authMethod: any,
    litAuthClient: LitAuthClient,
    permissionsContract: any,
  }> => {
    // 1. connect to lit nodes
    const litNodeClient = new LitNodeClient({ litNetwork: 'cayenne', debug: false });
    await litNodeClient.connect();

    // 2. connect to lit auth
    const litAuthClient = new LitAuthClient({
      litRelayConfig: {
        relayApiKey: '78e5179b1766c98836b29099732a9cc6-2023-08-11-sessionsigs-permission-scopes',
      },
      litNodeClient
    });

    // try parsing the auth method
    let _authMethod;

    try {
      _authMethod = dJSON.parse(authMethod);
    } catch (e) {
      alert('Invalid auth method');
      throw new Error('Invalid auth method')
    }

    // 3. connect to lit contracts
    const litContracts = new LitContracts();
    await litContracts.connect();

    // 4. use the permissions contract to fetch the token ids
    const permissionsContract = litContracts.pkpPermissionsContract;

    return {
      _authMethod,
      litAuthClient,
      permissionsContract,
    }
  }


  const handleSignAnything = async (pkp: any) => {
    const { _authMethod, litAuthClient, permissionsContract } = await getContext();
  }

  const handleSignMessage = async (pkp: any) => {
    const { _authMethod, litAuthClient, permissionsContract } = await getContext();
    console.log("pkp:", pkp);
    const litContracts = new LitContracts();
  }


  const fetchPKPs = async (authMethod: string) => {
    setLoading(true);
    setPkps([]);

    const { _authMethod, litAuthClient, permissionsContract } = await getContext();

    let tokenIds;
    let authId;
    switch (_authMethod.authMethodType) {
      // eth wallet
      case AuthMethodType.EthWallet:
        var authProvider = litAuthClient.initProvider(ProviderType.EthWallet);
        authId = await authProvider.getAuthMethodId(_authMethod);
        tokenIds = await permissionsContract.read.getTokenIdsForAuthMethod(AuthMethodType.EthWallet, authId);
        break;
      case AuthMethodType.GoogleJwt:
        var authProvider = litAuthClient.initProvider(ProviderType.Google);
        authId = await authProvider.getAuthMethodId(_authMethod);
        tokenIds = await permissionsContract.read.getTokenIdsForAuthMethod(AuthMethodType.GoogleJwt, authId);
        break;
      case AuthMethodType.Discord:
        var authProvider = litAuthClient.initProvider(ProviderType.Discord);
        authId = await authProvider.getAuthMethodId(_authMethod);
        tokenIds = await permissionsContract.read.getTokenIdsForAuthMethod(AuthMethodType.Discord, authId);
        break;
      case AuthMethodType.StytchOtp:
        var authProvider = litAuthClient.initProvider(ProviderType.StytchOtp);
        authId = await authProvider.getAuthMethodId(_authMethod);
        tokenIds = await permissionsContract.read.getTokenIdsForAuthMethod(AuthMethodType.StytchOtp, authId);
        break;
      case AuthMethodType.WebAuthn:
        var authProvider = litAuthClient.initProvider(ProviderType.WebAuthn);
        authId = await authProvider.getAuthMethodId(_authMethod);
        tokenIds = await permissionsContract.read.getTokenIdsForAuthMethod(AuthMethodType.WebAuthn, authId);
        break;
      default:
        alert('Unsupported auth method type');
        return;
    };

    console.log("tokenIds:", tokenIds);

    // -- get the pkps
    const pkps = [];
    for (let i = 0; i < tokenIds.length; i++) {
      const pubkey = await permissionsContract.read.getPubkey(tokenIds[i]);
      if (pubkey) {
        const ethAddress = ethers.utils.computeAddress(pubkey);

        // check the permission scopes
        const permissionScopes = await permissionsContract.read.getPermittedAuthMethodScopes(
          tokenIds[i],
          _authMethod.authMethodType,
          authId,
          3,
        );

        pkps.push({
          authId: authId,
          tokenId: tokenIds[i],
          publicKey: pubkey,
          ethAddress: ethAddress,
          scopes: {
            signAnything: permissionScopes[1],
            onlySignMessages: permissionScopes[2],
          },
        });
      }
    }

    // reverse the pkps order
    pkps.reverse();


    setPkps(pkps);
    setLoading(false);
  }

  return (
    <div className="p-4 text-2xl">
      <h1 className="mb-4">Your PKP will now need permission scopes, (eg. getting session sigs)</h1>

      <p className="mb-4">
        Copy and paste your auth method to fetch & check your PKPs' permission scopes.
      </p>

      <textarea
        onChange={(e) => setAuthMethod(e.target.value)}
        className="border-2 border-gray-300 rounded-md w-full p-2 mb-4 text-sm h-36"
        id="code"
        placeholder="Paste your auth method here... it should look like { authMethodType: 1, accessToken: {...}}"
      />

      <button onClick={() => fetchPKPs(authMethod)} className="border-1 bg-blue-500 p-2">Fetch PKPs</button>
      <hr className="mt-4 mb-4" />

      <h1 className="mb-4">Your PKPs (latest to oldest)</h1>

      {loading && <div className="text-blue-500">
        Loading...
      </div>
      }

      <div className="text-sm mb mx-auto overflow-hidden bg-white rounded-lg shadow-md">
        <ul className="divide-y divide-gray-200">
          {
            pkps?.length > 0 && pkps.map((p: any) => (
              <li key={p.tokenId} className={`p-4 ${(p.scopes.signAnything || p.scopes.onlySignMessages) ? '' : ''}`}>
                <h2 className="text-lg font-bold text-gray-700">Token ID: {p.tokenId.toString()}</h2>
                <p className="text-gray-600">Public Key: {p.publicKey}</p>
                <p className="text-gray-600">Eth Address: {p.ethAddress}</p>
                <p className="text-gray-600">
                  Scopes:{" "}
                  <span className="font-medium">
                    {p.scopes.signAnything ? "[1] Sign Anything" : ""}
                    {p.scopes.onlySignMessages ? "[2] Only Sign Messages" : ""}
                  </span>

                  {
                    !p.scopes.signAnything && !p.scopes.onlySignMessages && (
                      <span className="block mb-2 text-sm font-medium text-red-600 bg-red-100 rounded px-3 py-1">
                        DEPRECATED! This PKP has no permission scopes. Use a new one of fund this PKP with Lit token in order to add permission scopes using to permissions contract.
                      </span>
                    )
                  }
                </p>
              </li>
            ))
          }
        </ul>
      </div>

    </div>
  )
}
