//! Yolk minimal receipt storage contract for Concordium
use concordium_std::*;

#[derive(Serialize, SchemaType, Clone)]
pub struct Receipt {
    pub receipt_id: String,
    pub tx_hash: String,
    pub amount_plt: u128,
    pub ts_unix: u64,
}

#[derive(Serialize, SchemaType)]
pub struct ReceiptEmitted {
    pub receipt_id: String,
    pub tx_hash: String,
    pub ts_unix: u64,
}

#[derive(Serial, DeserialWithState)]
#[concordium(state_parameter = "S")]
pub struct State<S: HasStateApi> {
    receipts: StateMap<String, Receipt, S>,
}

impl<S: HasStateApi> State<S> {
    fn new(state_builder: &mut S::StateBuilder) -> Self {
        Self {
            receipts: state_builder.new_map(),
        }
    }
}

#[init(contract = "realpay")]
fn init<S: HasStateApi>(_ctx: &InitContext, state_builder: &mut S::StateBuilder) -> InitResult<State<S>> {
    Ok(State::new(state_builder))
}

#[receive(contract = "realpay", name = "mint_receipt", parameter = "Receipt", mutable)]
fn mint_receipt<S: HasStateApi>(ctx: &ReceiveContext, host: &mut Host<State<S>>) -> ReceiveResult<()> {
    let receipt: Receipt = ctx.parameter_cursor().get()?;
    let key = receipt.receipt_id.clone();
    let ts_unix = receipt.ts_unix;
    let tx_hash = receipt.tx_hash.clone();

    // store
    host.state_mut().receipts.insert(key.clone(), receipt);

    // emit event
    host.emit_event(&ReceiptEmitted {
        receipt_id: key,
        tx_hash,
        ts_unix,
    });
    Ok(())
}

#[receive(contract = "realpay", name = "get_receipt", parameter = "String", return_value = "Option<Receipt>")]
fn get_receipt<S: HasStateApi>(ctx: &ReceiveContext, host: &Host<State<S>>) -> ReceiveResult<Option<Receipt>> {
    let receipt_id: String = ctx.parameter_cursor().get()?;
    Ok(host.state().receipts.get(&receipt_id).cloned())
}