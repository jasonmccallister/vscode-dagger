export interface Command<TInput = void> {
  /**
   * Optional pre-execution hook to perform any necessary checks or setup.
   * Returns true if the command can proceed, false otherwise.
   */
  preExecute?(): Promise<boolean>;

  /**
   * Main execution method for the command.
   * Should be implemented by the command class.
   * @param input Optional input parameter for the command
   */
  execute(input?: TInput): Promise<void>;

  /**
   * Optional post-execution hook to perform cleanup or additional actions.
   * Can be used to handle any final steps after the command execution.
   */
  postExecute?(): Promise<void>;
}
